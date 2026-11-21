import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ExportPreviewModal } from './components/ExportPreviewModal';
import { Header } from './components/Header';
import { MediaFilmstrip } from './components/MediaFilmstrip';
import { PreviewStage } from './components/PreviewStage';
import { StudioControls } from './components/StudioControls';
import { computeAudioGainAtTime, decodeAudioTrack } from './engine/audio';
import {
  exportSlideshowVideo,
  triggerFileDownload,
} from './engine/exporter';
import { filesToSlides, loadSampleSlides } from './engine/samples';
import { buildRenderPlan } from './engine/themes';
import {
  AnimationId,
  AspectRatioId,
  AudioTrackConfig,
  ColorGradeConfig,
  ExportResolution,
  ExportResult,
  ExportStatus,
  InspectorTab,
  ParticleOverlayId,
  SlideImage,
  ThemeId,
  TitleCardConfig,
  TransitionId,
} from './types/studio';

const DEFAULT_COLOR_GRADE: ColorGradeConfig = {
  filter: 'auto',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  vignette: 35,
  useThemeVignette: true,
};

const DEFAULT_INTRO: TitleCardConfig = {
  enabled: false,
  title: 'Golden Hour Reel',
  subtitle: 'A Nilvid Reel · 2026',
  durationSec: 2.5,
  animation: 'fade-rise',
};

const DEFAULT_OUTRO: TitleCardConfig = {
  enabled: false,
  title: 'Thanks for Watching',
  subtitle: 'Created with Nilvid',
  durationSec: 2.5,
  animation: 'cinema-reveal',
};

export default function App() {
  const [slides, setSlides] = useState<SlideImage[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('theme');

  const [themeId, setThemeId] = useState<ThemeId>('cinematic');
  const [durationSec, setDurationSec] = useState<number>(20);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>('16:9');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');

  const [colorGrade, setColorGrade] =
    useState<ColorGradeConfig>(DEFAULT_COLOR_GRADE);
  const [particleOverlay, setParticleOverlay] =
    useState<ParticleOverlayId>('auto');
  const [intro, setIntro] = useState<TitleCardConfig>(DEFAULT_INTRO);
  const [outro, setOutro] = useState<TitleCardConfig>(DEFAULT_OUTRO);

  const [audioTrack, setAudioTrack] = useState<AudioTrackConfig | null>(null);
  const [audioLoading, setAudioLoading] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportProgressPct, setExportProgressPct] = useState<number>(0);
  const [exportElapsedSec, setExportElapsedSec] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [liveExportCanvas, setLiveExportCanvas] =
    useState<HTMLCanvasElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const currentTimeRef = useRef<number>(0);
  const slidesRef = useRef<SlideImage[]>([]);
  const exportResultRef = useRef<ExportResult | null>(null);
  const audioTrackRef = useRef<AudioTrackConfig | null>(null);

  // Web Audio live preview refs
  const previewAudioCtxRef = useRef<AudioContext | null>(null);
  const previewAudioGainRef = useRef<GainNode | null>(null);
  const previewAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  currentTimeRef.current = currentTimeSec;
  slidesRef.current = slides;
  exportResultRef.current = exportResult;
  audioTrackRef.current = audioTrack;

  useEffect(() => {
    let cancelled = false;
    loadSampleSlides()
      .then((sampleSlides) => {
        if (cancelled) return;
        setSlides(sampleSlides);
        setSelectedSlideId(sampleSlides[0]?.id ?? null);
        setIsPlaying(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      slidesRef.current.forEach((s) => {
        if (!s.isSample) URL.revokeObjectURL(s.url);
      });
      if (exportResultRef.current) {
        URL.revokeObjectURL(exportResultRef.current.blobUrl);
      }
      if (audioTrackRef.current) {
        URL.revokeObjectURL(audioTrackRef.current.url);
      }
      exportAbortRef.current?.abort();
      if (previewAudioCtxRef.current) {
        previewAudioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const plan = useMemo(
    () => buildRenderPlan(slides, themeId, durationSec, intro, outro),
    [slides, themeId, durationSec, intro, outro]
  );

  // Keep selectedSlideId valid when slides change
  useEffect(() => {
    if (slides.length === 0) {
      setSelectedSlideId(null);
      return;
    }
    if (!selectedSlideId || !slides.some((s) => s.id === selectedSlideId)) {
      setSelectedSlideId(slides[0].id);
    }
  }, [slides, selectedSlideId]);

  useEffect(() => {
    setCurrentTimeSec((prev) => Math.min(prev, durationSec));
  }, [durationSec]);

  // Real-time playback animation loop
  useEffect(() => {
    if (!isPlaying || slides.length === 0 || exportStatus === 'rendering') {
      lastFrameTimeRef.current = null;
      return;
    }

    let rafId = 0;

    const tick = (nowMs: number) => {
      if (lastFrameTimeRef.current !== null) {
        const dt = (nowMs - lastFrameTimeRef.current) / 1000;
        setCurrentTimeSec((prev) => {
          const next = prev + dt;
          const wrapped = next >= durationSec ? 0 : next;
          if (previewAudioGainRef.current && audioTrackRef.current) {
            previewAudioGainRef.current.gain.value = computeAudioGainAtTime(
              wrapped,
              durationSec,
              audioTrackRef.current.volume,
              audioTrackRef.current.fadeInSec,
              audioTrackRef.current.fadeOutSec
            );
          }
          return wrapped;
        });
      }
      lastFrameTimeRef.current = nowMs;
      rafId = requestAnimationFrame(tick);
    };

    lastFrameTimeRef.current = performance.now();
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      lastFrameTimeRef.current = null;
    };
  }, [isPlaying, slides.length, durationSec, exportStatus]);

  // Live preview Web Audio sync
  useEffect(() => {
    const stopPreviewAudio = () => {
      if (previewAudioSourceRef.current) {
        try {
          previewAudioSourceRef.current.stop();
          previewAudioSourceRef.current.disconnect();
        } catch {
          // ignore
        }
        previewAudioSourceRef.current = null;
      }
    };

    if (!isPlaying || !audioTrack || exportStatus === 'rendering' || slides.length === 0) {
      stopPreviewAudio();
      return;
    }

    const startAudio = async () => {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      if (!previewAudioCtxRef.current || previewAudioCtxRef.current.state === 'closed') {
        previewAudioCtxRef.current = new AudioCtx();
      }
      const ctx = previewAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      stopPreviewAudio();

      const source = ctx.createBufferSource();
      source.buffer = audioTrack.buffer;
      source.loop = true;

      const gainNode = ctx.createGain();
      gainNode.gain.value = computeAudioGainAtTime(
        currentTimeRef.current,
        durationSec,
        audioTrack.volume,
        audioTrack.fadeInSec,
        audioTrack.fadeOutSec
      );

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      const offset = currentTimeRef.current % Math.max(0.1, audioTrack.durationSec);
      source.start(0, offset);

      previewAudioSourceRef.current = source;
      previewAudioGainRef.current = gainNode;
    };

    startAudio();

    return () => {
      stopPreviewAudio();
    };
  }, [isPlaying, audioTrack, exportStatus, slides.length, durationSec]);

  // Spacebar play/pause shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          target.getAttribute('role') === 'slider')
      ) {
        return;
      }
      if (slides.length > 0 && exportStatus !== 'rendering' && !isPreviewModalOpen) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length, exportStatus, isPreviewModalOpen]);

  const handleFilesAdded = useCallback(async (files: FileList | File[]) => {
    try {
      const newSlides = await filesToSlides(files);
      if (newSlides.length === 0) return;

      setSlides((prev) => {
        const onlySamples = prev.length > 0 && prev.every((s) => s.isSample);
        if (onlySamples) {
          return newSlides;
        }
        return [...prev, ...newSlides];
      });
      setSelectedSlideId(newSlides[0].id);
      setCurrentTimeSec(0);
      setIsPlaying(true);
      setExportStatus('idle');
      setExportError(null);
    } catch {
      setExportError('One or more selected files could not be decoded as images.');
      setExportStatus('error');
    }
  }, []);

  const handleLoadSamples = useCallback(async () => {
    try {
      const sampleSlides = await loadSampleSlides();
      setSlides((prev) => {
        prev.forEach((s) => {
          if (!s.isSample) URL.revokeObjectURL(s.url);
        });
        return sampleSlides;
      });
      setSelectedSlideId(sampleSlides[0]?.id ?? null);
      setCurrentTimeSec(0);
      setIsPlaying(true);
      setExportStatus('idle');
      setExportError(null);
    } catch {
      setExportError('Could not load sample photos.');
      setExportStatus('error');
    }
  }, []);

  const handleClearAll = useCallback(() => {
    setIsPlaying(false);
    setCurrentTimeSec(0);
    setSlides((prev) => {
      prev.forEach((s) => {
        if (!s.isSample) URL.revokeObjectURL(s.url);
      });
      return [];
    });
    setSelectedSlideId(null);
    setExportStatus('idle');
    setExportError(null);
  }, []);

  const handleRemoveSlide = useCallback((id: string) => {
    setSlides((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target && !target.isSample) {
        URL.revokeObjectURL(target.url);
      }
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        setIsPlaying(false);
        setCurrentTimeSec(0);
      }
      return next;
    });
  }, []);

  const handleMoveSlide = useCallback((index: number, direction: -1 | 1) => {
    setSlides((prev) => {
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, moved);
      return copy;
    });
  }, []);

  const handleReorderSlide = useCallback((fromIndex: number, toIndex: number) => {
    setSlides((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }, []);

  const handleDuplicateSlide = useCallback((slideId: string) => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === slideId);
      if (idx === -1) return prev;
      const orig = prev[idx];
      const clone: SlideImage = {
        ...orig,
        id: `slide-copy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        isSample: true, // keep original URL lifetime safe on clone
      };
      const copy = [...prev];
      copy.splice(idx + 1, 0, clone);
      return copy;
    });
  }, []);

  const handleUpdateSlide = useCallback(
    (slideId: string, patch: Partial<SlideImage>) => {
      setSlides((prev) =>
        prev.map((s) => (s.id === slideId ? { ...s, ...patch } : s))
      );
      setExportStatus('idle');
    },
    []
  );

  const handleApplyAnimationToAll = useCallback((anim: AnimationId) => {
    setSlides((prev) => prev.map((s) => ({ ...s, animationOverride: anim })));
    setExportStatus('idle');
  }, []);

  const handleApplyTransitionToAll = useCallback((trans: TransitionId) => {
    setSlides((prev) =>
      prev.map((s) => ({ ...s, transitionOverride: trans }))
    );
    setExportStatus('idle');
  }, []);

  const handleResetAllSlideOverrides = useCallback(() => {
    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        animationOverride: undefined,
        transitionOverride: undefined,
      }))
    );
    setExportStatus('idle');
  }, []);

  const handleUploadAudio = useCallback(async (file: File) => {
    setAudioLoading(true);
    setAudioError(null);
    try {
      const decoded = await decodeAudioTrack(file);
      setAudioTrack((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return decoded;
      });
      setExportStatus('idle');
    } catch {
      setAudioError('Could not decode this audio file. Try MP3, WAV, or OGG.');
    } finally {
      setAudioLoading(false);
    }
  }, []);

  const handleRemoveAudio = useCallback(() => {
    setAudioTrack((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setExportStatus('idle');
  }, []);

  const handleStartExport = useCallback(async () => {
    if (slides.length === 0 || exportStatus === 'rendering') return;

    setIsPlaying(false);
    setExportError(null);
    setExportProgressPct(0);
    setExportElapsedSec(0);
    setExportStatus('rendering');

    if (exportResult) {
      URL.revokeObjectURL(exportResult.blobUrl);
      setExportResult(null);
    }

    const controller = new AbortController();
    exportAbortRef.current = controller;

    try {
      const result = await exportSlideshowVideo({
        plan,
        themeId,
        aspectRatio,
        resolution,
        colorGrade,
        particleOverlay,
        intro,
        outro,
        audioTrack,
        signal: controller.signal,
        onProgress: (pct, elapsed) => {
          setExportProgressPct(pct);
          setExportElapsedSec(elapsed);
          setCurrentTimeSec(elapsed);
        },
        onPreviewFrame: (canvas) => {
          setLiveExportCanvas(canvas);
        },
      });

      setLiveExportCanvas(null);
      setExportResult(result);
      setExportStatus('complete');
      triggerFileDownload(result.blobUrl, result.filename);
    } catch (err) {
      setLiveExportCanvas(null);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setExportStatus('idle');
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : 'Video export failed in this browser.';
      setExportError(message);
      setExportStatus('error');
    } finally {
      exportAbortRef.current = null;
    }
  }, [
    slides.length,
    exportStatus,
    exportResult,
    plan,
    themeId,
    aspectRatio,
    resolution,
    colorGrade,
    particleOverlay,
    intro,
    outro,
    audioTrack,
  ]);

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
  }, []);

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const selectedSlide = useMemo(
    () => slides.find((s) => s.id === selectedSlideId) ?? slides[0] ?? null,
    [slides, selectedSlideId]
  );

  const selectedScheduleItem = useMemo(
    () =>
      plan.schedule.find((item) => item.slide.id === selectedSlide?.id) ??
      plan.schedule[0] ??
      null,
    [plan.schedule, selectedSlide]
  );

  const isExporting = exportStatus === 'rendering';

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesAdded(e.target.files);
            e.target.value = '';
          }
        }}
      />

      <Header
        canExport={slides.length > 0}
        isExporting={isExporting}
        onExportClick={handleStartExport}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col gap-5">
        {/* Primary Pro Studio Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
          <PreviewStage
            plan={plan}
            themeId={themeId}
            currentTimeSec={currentTimeSec}
            isPlaying={isPlaying}
            isExporting={isExporting}
            exportProgressPct={exportProgressPct}
            aspectRatio={aspectRatio}
            colorGrade={colorGrade}
            particleOverlay={particleOverlay}
            intro={intro}
            outro={outro}
            audioTrack={audioTrack}
            hasSlides={slides.length > 0}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onRestart={() => {
              setCurrentTimeSec(0);
              setIsPlaying(true);
            }}
            onSeek={(t) => {
              setIsPlaying(false);
              setCurrentTimeSec(t);
            }}
            onAspectRatioChange={(ratio) => {
              setAspectRatio(ratio);
              setExportStatus('idle');
            }}
            onFilesDropped={handleFilesAdded}
            onOpenFilePicker={handleOpenFilePicker}
            onLoadSamples={handleLoadSamples}
            externalExportCanvas={liveExportCanvas}
          />

          <StudioControls
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedTheme={themeId}
            durationSec={durationSec}
            slideCount={slides.length}
            stepDuration={plan.stepDuration}
            transitionDuration={plan.transitionDuration}
            resolution={resolution}
            selectedSlide={selectedSlide}
            selectedScheduleItem={selectedScheduleItem}
            colorGrade={colorGrade}
            particleOverlay={particleOverlay}
            intro={intro}
            outro={outro}
            audioTrack={audioTrack}
            audioLoading={audioLoading}
            audioError={audioError}
            exportStatus={exportStatus}
            exportProgressPct={exportProgressPct}
            exportElapsedSec={exportElapsedSec}
            exportError={exportError}
            exportResult={exportResult}
            onSelectTheme={(id) => {
              setThemeId(id);
              setExportStatus('idle');
            }}
            onDurationChange={(sec) => {
              setDurationSec(sec);
              setExportStatus('idle');
            }}
            onResolutionChange={(res) => {
              setResolution(res);
              setExportStatus('idle');
            }}
            onUpdateSlide={handleUpdateSlide}
            onApplyAnimationToAll={handleApplyAnimationToAll}
            onApplyTransitionToAll={handleApplyTransitionToAll}
            onResetAllSlideOverrides={handleResetAllSlideOverrides}
            onUpdateColorGrade={(patch) => {
              setColorGrade((prev) => ({ ...prev, ...patch }));
              setExportStatus('idle');
            }}
            onResetColorGrade={() => {
              setColorGrade(DEFAULT_COLOR_GRADE);
              setExportStatus('idle');
            }}
            onSelectParticleOverlay={(id) => {
              setParticleOverlay(id);
              setExportStatus('idle');
            }}
            onUpdateIntro={(patch) => {
              setIntro((prev) => ({ ...prev, ...patch }));
              setExportStatus('idle');
            }}
            onUpdateOutro={(patch) => {
              setOutro((prev) => ({ ...prev, ...patch }));
              setExportStatus('idle');
            }}
            onUploadAudio={handleUploadAudio}
            onUpdateAudio={(patch) => {
              setAudioTrack((prev) => (prev ? { ...prev, ...patch } : prev));
              setExportStatus('idle');
            }}
            onRemoveAudio={handleRemoveAudio}
            onStartExport={handleStartExport}
            onCancelExport={handleCancelExport}
            onDownloadResult={() => {
              if (exportResult) {
                triggerFileDownload(exportResult.blobUrl, exportResult.filename);
              }
            }}
            onOpenPreviewModal={() => setIsPreviewModalOpen(true)}
          />
        </div>

        {/* Sequence Filmstrip with Drag-to-Reorder */}
        <MediaFilmstrip
          schedule={plan.schedule}
          selectedSlideId={selectedSlide?.id ?? null}
          currentTimeSec={currentTimeSec}
          isExporting={isExporting}
          onOpenFilePicker={handleOpenFilePicker}
          onFilesDropped={handleFilesAdded}
          onLoadSamples={handleLoadSamples}
          onClearAll={handleClearAll}
          onMoveSlide={handleMoveSlide}
          onReorderSlide={handleReorderSlide}
          onDuplicateSlide={handleDuplicateSlide}
          onRemoveSlide={handleRemoveSlide}
          onSelectAndJumpToSlide={(slideId, timeSec) => {
            setSelectedSlideId(slideId);
            setCurrentTimeSec(timeSec);
          }}
        />
      </main>

      <ExportPreviewModal
        result={exportResult}
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        onDownload={() => {
          if (exportResult) {
            triggerFileDownload(exportResult.blobUrl, exportResult.filename);
          }
        }}
      />
    </div>
  );
}
