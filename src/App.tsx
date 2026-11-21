import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ExportPreviewModal } from './components/ExportPreviewModal';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { MediaBin } from './components/MediaBin';
import { PreviewStage } from './components/PreviewStage';
import { StudioControls } from './components/StudioControls';
import { TimelineEditor } from './components/TimelineEditor';
import { computeAudioClipGain } from './engine/audio';
import {
  exportSlideshowVideo,
  triggerFileDownload,
} from './engine/exporter';
import {
  clearPersistedProject,
  loadPersistedProject,
  savePersistedProject,
  SaveProjectInput,
} from './engine/persistence';
import {
  cloneTimelineClip,
  createAudioClipFromAsset,
  createTimelineClipFromAsset,
  filesToMediaAssets,
  loadSampleAssets,
} from './engine/samples';
import { buildRenderPlan } from './engine/themes';
import {
  AnimationId,
  AspectRatioId,
  AudioClip,
  ColorGradeConfig,
  ExportFormat,
  ExportResolution,
  ExportResult,
  ExportStatus,
  InspectorTab,
  MediaAsset,
  ParticleOverlayId,
  SelectionTarget,
  ThemeId,
  TimelineClip,
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

interface ActiveAudioNode {
  kind: 'audio' | 'video';
  id: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
}

export default function App() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [activeTab, setActiveTab] = useState<InspectorTab>('clip');

  const [themeId, setThemeId] = useState<ThemeId>('cinematic');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>('16:9');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4');

  const [colorGrade, setColorGrade] =
    useState<ColorGradeConfig>(DEFAULT_COLOR_GRADE);
  const [particleOverlay, setParticleOverlay] =
    useState<ParticleOverlayId>('auto');
  const [intro, setIntro] = useState<TitleCardConfig>(DEFAULT_INTRO);
  const [outro, setOutro] = useState<TitleCardConfig>(DEFAULT_OUTRO);

  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioSyncEpoch, setAudioSyncEpoch] = useState<number>(0);

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
  const ownedBlobUrlsRef = useRef<Set<string>>(new Set());
  const exportResultRef = useRef<ExportResult | null>(null);
  const audioClipsRef = useRef<AudioClip[]>([]);
  const clipsRef = useRef<TimelineClip[]>([]);
  const isHydratedRef = useRef<boolean>(false);
  const latestSnapshotRef = useRef<SaveProjectInput | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  // Live preview Web Audio refs
  const previewAudioCtxRef = useRef<AudioContext | null>(null);
  const activeAudioNodesRef = useRef<ActiveAudioNode[]>([]);

  currentTimeRef.current = currentTimeSec;
  exportResultRef.current = exportResult;
  audioClipsRef.current = audioClips;
  clipsRef.current = clips;

  const plan = useMemo(
    () => buildRenderPlan(clips, themeId, intro, outro, audioClips),
    [clips, themeId, intro, outro, audioClips]
  );

  // Hydrate persisted project from IndexedDB on load, or initialize sample set
  useEffect(() => {
    let cancelled = false;

    const initWorkspace = async () => {
      try {
        const restored = await loadPersistedProject();
        if (cancelled) {
          restored?.createdBlobUrls.forEach((u) => URL.revokeObjectURL(u));
          return;
        }

        if (
          restored &&
          (restored.assets.length > 0 ||
            restored.clips.length > 0 ||
            restored.audioClips.length > 0)
        ) {
          restored.createdBlobUrls.forEach((u) =>
            ownedBlobUrlsRef.current.add(u)
          );
          setAssets(restored.assets);
          setClips(restored.clips);
          setAudioClips(restored.audioClips);
          setSelection(restored.selection);
          setActiveTab(restored.activeTab);
          setThemeId(restored.themeId);
          setAspectRatio(restored.aspectRatio);
          setResolution(restored.resolution);
          setExportFormat(restored.exportFormat);
          setColorGrade(restored.colorGrade);
          setParticleOverlay(restored.particleOverlay);
          setIntro(restored.intro);
          setOutro(restored.outro);
          setCurrentTimeSec(restored.currentTimeSec);
          setIsPlaying(false);
          isHydratedRef.current = true;
          return;
        }
      } catch {
        // Fall through to sample initialization
      }

      try {
        const sampleAssets = await loadSampleAssets();
        if (cancelled) return;
        const initialClips = sampleAssets.map((a) =>
          createTimelineClipFromAsset(a)
        );
        setAssets(sampleAssets);
        setClips(initialClips);
        setSelection(
          initialClips[0] ? { type: 'clip', id: initialClips[0].id } : null
        );
        setIsPlaying(true);
      } catch {
        // ignore
      } finally {
        if (!cancelled) {
          isHydratedRef.current = true;
        }
      }
    };

    initWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-save project & media blobs to IndexedDB whenever edits occur
  useEffect(() => {
    const snapshot: SaveProjectInput = {
      assets,
      clips,
      audioClips,
      selection,
      activeTab,
      themeId,
      aspectRatio,
      resolution,
      exportFormat,
      colorGrade,
      particleOverlay,
      intro,
      outro,
      currentTimeSec: currentTimeRef.current,
    };
    latestSnapshotRef.current = snapshot;

    if (!isHydratedRef.current) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      if (latestSnapshotRef.current) {
        savePersistedProject(latestSnapshotRef.current).catch(() => {});
      }
    }, 80);
  }, [
    assets,
    clips,
    audioClips,
    selection,
    activeTab,
    themeId,
    aspectRatio,
    resolution,
    exportFormat,
    colorGrade,
    particleOverlay,
    intro,
    outro,
  ]);

  // Flush pending project save immediately before refresh / tab hide
  useEffect(() => {
    const flushSave = () => {
      if (!isHydratedRef.current || !latestSnapshotRef.current) return;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const snapshot: SaveProjectInput = {
        ...latestSnapshotRef.current,
        currentTimeSec: currentTimeRef.current,
      };
      savePersistedProject(snapshot).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
      }
    };

    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Cleanup owned URLs, audio contexts, and export abort on unmount
  useEffect(() => {
    return () => {
      ownedBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      ownedBlobUrlsRef.current.clear();
      if (exportResultRef.current) {
        URL.revokeObjectURL(exportResultRef.current.blobUrl);
      }
      exportAbortRef.current?.abort();
      activeAudioNodesRef.current.forEach((n) => {
        try {
          n.source.stop();
          n.source.disconnect();
        } catch {
          // ignore
        }
      });
      if (previewAudioCtxRef.current) {
        previewAudioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Keep selection valid when clips/audioClips change
  useEffect(() => {
    if (!selection) {
      if (clips.length > 0) {
        setSelection({ type: 'clip', id: clips[0].id });
      }
      return;
    }
    if (
      selection.type === 'clip' &&
      !clips.some((c) => c.id === selection.id)
    ) {
      setSelection(clips[0] ? { type: 'clip', id: clips[0].id } : null);
    } else if (
      selection.type === 'audio' &&
      !audioClips.some((a) => a.id === selection.id)
    ) {
      setSelection(clips[0] ? { type: 'clip', id: clips[0].id } : null);
    }
  }, [clips, audioClips, selection]);

  useEffect(() => {
    setCurrentTimeSec((prev) => Math.min(prev, plan.totalDuration));
  }, [plan.totalDuration]);

  const stopPreviewAudioNodes = useCallback(() => {
    activeAudioNodesRef.current.forEach((entry) => {
      try {
        entry.source.stop();
        entry.source.disconnect();
      } catch {
        // ignore
      }
    });
    activeAudioNodesRef.current = [];
  }, []);

  // Real-time playback animation loop
  useEffect(() => {
    const hasContent = clips.length > 0 || audioClips.length > 0;
    if (!isPlaying || !hasContent || exportStatus === 'rendering') {
      lastFrameTimeRef.current = null;
      return;
    }

    let rafId = 0;

    const tick = (nowMs: number) => {
      if (lastFrameTimeRef.current !== null) {
        const dt = (nowMs - lastFrameTimeRef.current) / 1000;
        const nextRaw = currentTimeRef.current + dt;
        const wrappedOut = nextRaw >= plan.totalDuration;
        const wrapped = wrappedOut ? 0 : nextRaw;

        // Real-time per-clip gain updates for fades on Track A1 & Track V1
        for (const node of activeAudioNodesRef.current) {
          if (node.kind === 'audio') {
            const aClip = audioClipsRef.current.find((a) => a.id === node.id);
            node.gainNode.gain.value = aClip
              ? computeAudioClipGain(aClip, wrapped)
              : 0;
          } else {
            const item = plan.schedule.find((s) => s.clip.id === node.id);
            const active =
              item &&
              wrapped >= item.startTime &&
              wrapped <= item.endTime &&
              !item.clip.muted;
            node.gainNode.gain.value = active ? item.clip.volume : 0;
          }
        }

        if (wrappedOut) {
          setAudioSyncEpoch((e) => e + 1);
        }
        setCurrentTimeSec(wrapped);
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
  }, [
    isPlaying,
    clips.length,
    audioClips.length,
    plan,
    exportStatus,
  ]);

  // Multi-clip Web Audio scheduling for live preview
  const audioGraphSignature = useMemo(
    () =>
      JSON.stringify({
        a: audioClips.map((a) => [
          a.id,
          a.startTime,
          a.durationSec,
          a.sourceOffsetSec,
        ]),
        v: plan.schedule.map((s) => [
          s.clip.id,
          s.startTime,
          s.endTime,
          s.clip.sourceStartSec,
          s.clip.speed,
          s.clip.muted,
        ]),
      }),
    [audioClips, plan.schedule]
  );

  useEffect(() => {
    const hasContent = clips.length > 0 || audioClips.length > 0;
    if (!isPlaying || !hasContent || exportStatus === 'rendering') {
      stopPreviewAudioNodes();
      return;
    }

    let cancelled = false;

    const startAudioMix = async () => {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      if (
        !previewAudioCtxRef.current ||
        previewAudioCtxRef.current.state === 'closed'
      ) {
        previewAudioCtxRef.current = new AudioCtx();
      }
      const ctx = previewAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      if (cancelled) return;

      stopPreviewAudioNodes();

      const nowT = currentTimeRef.current;
      const baseAudioTime = ctx.currentTime + 0.015;
      const nextNodes: ActiveAudioNode[] = [];

      // Schedule Track A1 song clips
      for (const aClip of audioClipsRef.current) {
        const clipEnd = aClip.startTime + aClip.durationSec;
        if (clipEnd <= nowT + 0.02) continue;

        const source = ctx.createBufferSource();
        source.buffer = aClip.buffer;
        source.loop = true;

        const gainNode = ctx.createGain();
        gainNode.gain.value = computeAudioClipGain(aClip, nowT);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        const delaySec = Math.max(0, aClip.startTime - nowT);
        const alreadyElapsed = Math.max(0, nowT - aClip.startTime);
        const srcOffset =
          (aClip.sourceOffsetSec + alreadyElapsed) %
          Math.max(0.1, aClip.sourceDurationSec);
        const playDur = Math.max(0.05, clipEnd - Math.max(nowT, aClip.startTime));

        source.start(baseAudioTime + delaySec, srcOffset, playDur);
        nextNodes.push({ kind: 'audio', id: aClip.id, source, gainNode });
      }

      // Schedule unmuted Track V1 video audio
      for (const item of plan.schedule) {
        const clip = item.clip;
        if (
          clip.kind !== 'video' ||
          clip.muted ||
          !clip.audioBuffer ||
          item.endTime <= nowT + 0.02
        ) {
          continue;
        }

        const source = ctx.createBufferSource();
        source.buffer = clip.audioBuffer;
        const rate = Math.max(0.25, Math.min(4.0, clip.speed));
        source.playbackRate.value = rate;

        const gainNode = ctx.createGain();
        const isInside = nowT >= item.startTime && nowT <= item.endTime;
        gainNode.gain.value = isInside ? clip.volume : 0;

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        const delaySec = Math.max(0, item.startTime - nowT);
        const alreadyElapsed = Math.max(0, nowT - item.startTime);
        const srcOffset = clip.sourceStartSec + alreadyElapsed * rate;
        const remainingTimelineDur = Math.max(
          0.05,
          item.endTime - Math.max(nowT, item.startTime)
        );
        const sourceSpan = Math.min(
          Math.max(0.05, clip.sourceDurationSec - srcOffset),
          remainingTimelineDur * rate
        );

        if (sourceSpan > 0.05 && srcOffset < clip.sourceDurationSec) {
          source.start(baseAudioTime + delaySec, srcOffset, sourceSpan);
          nextNodes.push({ kind: 'video', id: clip.id, source, gainNode });
        }
      }

      activeAudioNodesRef.current = nextNodes;
    };

    startAudioMix();

    return () => {
      cancelled = true;
      stopPreviewAudioNodes();
    };
  }, [
    isPlaying,
    exportStatus,
    clips.length,
    audioClips.length,
    audioGraphSignature,
    audioSyncEpoch,
    plan.schedule,
    stopPreviewAudioNodes,
  ]);

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSelectTarget = useCallback((target: SelectionTarget) => {
    setSelection(target);
    if (target) {
      setActiveTab('clip');
    }
  }, []);

  const handleSeek = useCallback(
    (timeSec: number) => {
      const clamped = Math.max(0, Math.min(plan.totalDuration, timeSec));
      currentTimeRef.current = clamped;
      setCurrentTimeSec(clamped);
      if (isPlaying) {
        setAudioSyncEpoch((e) => e + 1);
      }
    },
    [plan.totalDuration, isPlaying]
  );

  // Import files into Media Bin AND add onto Timeline
  const handleFilesAdded = useCallback(
    async (
      files: FileList | File[],
      targetTrack?: 'video' | 'audio',
      atTimeSec?: number
    ) => {
      try {
        const decodedAssets = await filesToMediaAssets(files);
        if (decodedAssets.length === 0) return;

        decodedAssets.forEach((a) => {
          if (!a.isSample && a.url.startsWith('blob:')) {
            ownedBlobUrlsRef.current.add(a.url);
          }
        });

        setAssets((prev) => [...prev, ...decodedAssets]);

        const visualAssets = decodedAssets.filter(
          (a) => a.kind === 'image' || a.kind === 'video'
        );
        const audioAssets = decodedAssets.filter((a) => a.kind === 'audio');

        let nextSelection: SelectionTarget = null;

        if (visualAssets.length > 0 && targetTrack !== 'audio') {
          const newClips = visualAssets.map((a) =>
            createTimelineClipFromAsset(a)
          );
          setClips((prev) => {
            const sampleAssetIds = new Set(
              assets.filter((a) => a.isSample).map((a) => a.id)
            );
            const onlySamples =
              prev.length > 0 &&
              prev.every((c) => sampleAssetIds.has(c.assetId));
            return onlySamples ? newClips : [...prev, ...newClips];
          });
          nextSelection = { type: 'clip', id: newClips[0].id };
        }

        if (audioAssets.length > 0) {
          let cursor = atTimeSec ?? currentTimeRef.current;
          const newAudioClips: AudioClip[] = [];
          for (const aAsset of audioAssets) {
            const created = createAudioClipFromAsset(aAsset, cursor);
            if (created) {
              newAudioClips.push(created);
              cursor += created.durationSec;
            }
          }
          if (newAudioClips.length > 0) {
            setAudioClips((prev) => [...prev, ...newAudioClips]);
            if (!nextSelection) {
              nextSelection = { type: 'audio', id: newAudioClips[0].id };
            }
          }
        }

        if (nextSelection) {
          setSelection(nextSelection);
          setActiveTab('clip');
        }
        setExportStatus('idle');
        setExportError(null);
      } catch {
        setExportError(
          'One or more selected files could not be decoded in this browser.'
        );
        setExportStatus('error');
      }
    },
    [assets]
  );

  const handleLoadSamples = useCallback(async () => {
    try {
      const sampleAssets = await loadSampleAssets();
      const sampleClips = sampleAssets.map((a) =>
        createTimelineClipFromAsset(a)
      );
      setAssets((prev) => [...sampleAssets, ...prev.filter((a) => !a.isSample)]);
      setClips(sampleClips);
      setSelection(
        sampleClips[0] ? { type: 'clip', id: sampleClips[0].id } : null
      );
      setCurrentTimeSec(0);
      setIsPlaying(true);
      setExportStatus('idle');
      setExportError(null);
    } catch {
      setExportError('Could not load sample photos.');
      setExportStatus('error');
    }
  }, []);

  const handleAddAssetToTimeline = useCallback(
    (asset: MediaAsset, insertIndex?: number, audioStartTime?: number) => {
      if (asset.kind === 'audio') {
        const startAt = audioStartTime ?? currentTimeRef.current;
        const aClip = createAudioClipFromAsset(asset, startAt);
        if (!aClip) return;
        setAudioClips((prev) => [...prev, aClip]);
        setSelection({ type: 'audio', id: aClip.id });
        setActiveTab('clip');
        setExportStatus('idle');
        return;
      }

      const newClip = createTimelineClipFromAsset(asset);
      setClips((prev) => {
        if (
          typeof insertIndex === 'number' &&
          insertIndex >= 0 &&
          insertIndex <= prev.length
        ) {
          const copy = [...prev];
          copy.splice(insertIndex, 0, newClip);
          return copy;
        }
        return [...prev, newClip];
      });
      setSelection({ type: 'clip', id: newClip.id });
      setActiveTab('clip');
      setExportStatus('idle');
    },
    []
  );

  const handleDropAssetToVideoTrack = useCallback(
    (assetId: string, insertIndex?: number) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset || asset.kind === 'audio') return;
      handleAddAssetToTimeline(asset, insertIndex);
    },
    [assets, handleAddAssetToTimeline]
  );

  const handleDropAssetToAudioTrack = useCallback(
    (assetId: string, startTime: number) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset || asset.kind !== 'audio') return;
      handleAddAssetToTimeline(asset, undefined, startTime);
    },
    [assets, handleAddAssetToTimeline]
  );

  const handleRemoveAsset = useCallback((assetId: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  }, []);

  const handleResetProject = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTimeSec(0);
    setExportStatus('idle');
    setExportError(null);
    await clearPersistedProject();
    ownedBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    ownedBlobUrlsRef.current.clear();

    try {
      const sampleAssets = await loadSampleAssets();
      const initialClips = sampleAssets.map((a) =>
        createTimelineClipFromAsset(a)
      );
      setAssets(sampleAssets);
      setClips(initialClips);
      setAudioClips([]);
      setSelection(
        initialClips[0] ? { type: 'clip', id: initialClips[0].id } : null
      );
      setThemeId('cinematic');
      setAspectRatio('16:9');
      setResolution('1080p');
      setExportFormat('mp4');
      setColorGrade(DEFAULT_COLOR_GRADE);
      setParticleOverlay('auto');
      setIntro(DEFAULT_INTRO);
      setOutro(DEFAULT_OUTRO);
      setIsPlaying(true);
    } catch {
      setAssets([]);
      setClips([]);
      setAudioClips([]);
      setSelection(null);
    }
  }, []);

  const handleReorderVideoClip = useCallback(
    (fromIndex: number, toIndex: number) => {
      setClips((prev) => {
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
      setExportStatus('idle');
    },
    []
  );

  const handleUpdateVideoClip = useCallback(
    (clipId: string, patch: Partial<TimelineClip>) => {
      setClips((prev) =>
        prev.map((c) => (c.id === clipId ? { ...c, ...patch } : c))
      );
      setExportStatus('idle');
    },
    []
  );

  const handleUpdateAudioClip = useCallback(
    (audioClipId: string, patch: Partial<AudioClip>) => {
      setAudioClips((prev) =>
        prev.map((a) => (a.id === audioClipId ? { ...a, ...patch } : a))
      );
      setExportStatus('idle');
    },
    []
  );

  const handleDeleteAudioClip = useCallback((audioClipId: string) => {
    setAudioClips((prev) => prev.filter((a) => a.id !== audioClipId));
    setExportStatus('idle');
  }, []);

  // Split selected video/photo clip OR song clip at the current playhead
  const handleSplitAtPlayhead = useCallback(() => {
    if (!selection) return;

    if (selection.type === 'clip') {
      const item = plan.schedule.find((s) => s.clip.id === selection.id);
      if (!item) return;

      const splitLocalTime = currentTimeRef.current - item.startTime;
      if (
        splitLocalTime <= 0.25 ||
        splitLocalTime >= item.clip.durationSec - 0.25
      ) {
        return;
      }

      const leftDuration = Number(splitLocalTime.toFixed(2));
      const rightDuration = Number(
        (item.clip.durationSec - leftDuration).toFixed(2)
      );

      const rightClone = cloneTimelineClip(item.clip);
      rightClone.durationSec = Math.max(0.5, rightDuration);
      if (rightClone.kind === 'video') {
        rightClone.sourceStartSec = Number(
          (item.clip.sourceStartSec + leftDuration * item.clip.speed).toFixed(2)
        );
      }

      setClips((prev) => {
        const idx = prev.findIndex((c) => c.id === item.clip.id);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = { ...prev[idx], durationSec: Math.max(0.5, leftDuration) };
        copy.splice(idx + 1, 0, rightClone);
        return copy;
      });
      setSelection({ type: 'clip', id: rightClone.id });
      setExportStatus('idle');
      return;
    }

    if (selection.type === 'audio') {
      const aClip = audioClips.find((a) => a.id === selection.id);
      if (!aClip) return;

      const splitOffset = currentTimeRef.current - aClip.startTime;
      if (splitOffset <= 0.25 || splitOffset >= aClip.durationSec - 0.25) {
        return;
      }

      const leftDur = Number(splitOffset.toFixed(2));
      const rightDur = Number((aClip.durationSec - leftDur).toFixed(2));

      const rightClip: AudioClip = {
        ...aClip,
        id: `audioclip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startTime: Number((aClip.startTime + leftDur).toFixed(2)),
        durationSec: Math.max(0.5, rightDur),
        sourceOffsetSec: Number((aClip.sourceOffsetSec + leftDur).toFixed(2)),
      };

      setAudioClips((prev) => {
        const idx = prev.findIndex((a) => a.id === aClip.id);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], durationSec: Math.max(0.5, leftDur) };
        copy.splice(idx + 1, 0, rightClip);
        return copy;
      });
      setSelection({ type: 'audio', id: rightClip.id });
      setExportStatus('idle');
    }
  }, [selection, plan.schedule, audioClips]);

  const handleDuplicateSelected = useCallback(() => {
    if (!selection) return;
    if (selection.type === 'clip') {
      const target = clips.find((c) => c.id === selection.id);
      if (!target) return;
      const cloned = cloneTimelineClip(target);
      setClips((prev) => {
        const idx = prev.findIndex((c) => c.id === target.id);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy.splice(idx + 1, 0, cloned);
        return copy;
      });
      setSelection({ type: 'clip', id: cloned.id });
      setExportStatus('idle');
      return;
    }

    const aClip = audioClips.find((a) => a.id === selection.id);
    if (!aClip) return;
    const clonedAudio: AudioClip = {
      ...aClip,
      id: `audioclip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      startTime: Number((aClip.startTime + aClip.durationSec).toFixed(2)),
    };
    setAudioClips((prev) => [...prev, clonedAudio]);
    setSelection({ type: 'audio', id: clonedAudio.id });
    setExportStatus('idle');
  }, [selection, clips, audioClips]);

  const handleDeleteSelected = useCallback(() => {
    if (!selection) return;
    if (selection.type === 'clip') {
      setClips((prev) => {
        const next = prev.filter((c) => c.id !== selection.id);
        if (next.length === 0 && audioClipsRef.current.length === 0) {
          setIsPlaying(false);
          setCurrentTimeSec(0);
        }
        return next;
      });
      setExportStatus('idle');
      return;
    }
    setAudioClips((prev) => prev.filter((a) => a.id !== selection.id));
    setExportStatus('idle');
  }, [selection]);

  const handleFitTotalDuration = useCallback(
    (targetSeconds: number) => {
      if (clips.length === 0) return;
      const clampedTarget = Math.max(10, Math.min(60, targetSeconds));
      const introOverlap = intro.enabled
        ? Math.max(0.35, intro.durationSec - 0.45)
        : 0;
      const outroOverlap = outro.enabled
        ? Math.max(0.35, outro.durationSec - 0.45)
        : 0;
      const currentVisualSpan = Math.max(
        1,
        plan.slidesEnd - plan.slidesStart
      );
      const desiredVisualSpan = Math.max(
        clips.length * 0.8,
        clampedTarget - introOverlap - outroOverlap
      );
      const ratio = desiredVisualSpan / currentVisualSpan;

      setClips((prev) =>
        prev.map((clip) => {
          const scaled = Math.max(0.8, Number((clip.durationSec * ratio).toFixed(2)));
          if (clip.kind === 'video') {
            const maxDur = Math.max(
              0.5,
              (clip.sourceDurationSec - clip.sourceStartSec) / clip.speed
            );
            return { ...clip, durationSec: Math.min(maxDur, scaled) };
          }
          return { ...clip, durationSec: Math.min(25, scaled) };
        })
      );
      setExportStatus('idle');
    },
    [clips.length, intro.enabled, intro.durationSec, outro.enabled, outro.durationSec, plan.slidesEnd, plan.slidesStart]
  );

  const handleApplyAnimationToAll = useCallback((anim: AnimationId) => {
    setClips((prev) => prev.map((c) => ({ ...c, animationOverride: anim })));
    setExportStatus('idle');
  }, []);

  const handleApplyTransitionToAll = useCallback((trans: TransitionId) => {
    setClips((prev) => prev.map((c) => ({ ...c, transitionOverride: trans })));
    setExportStatus('idle');
  }, []);

  const handleResetAllClipOverrides = useCallback(() => {
    setClips((prev) =>
      prev.map((c) => ({
        ...c,
        animationOverride: undefined,
        transitionOverride: undefined,
        filterOverride: undefined,
      }))
    );
    setExportStatus('idle');
  }, []);

  const handleUploadAudioFile = useCallback(
    async (file: File) => {
      await handleFilesAdded([file], 'audio', currentTimeRef.current);
    },
    [handleFilesAdded]
  );

  // Keyboard shortcuts: Space (play/pause), S (split cut at playhead)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      if (exportStatus === 'rendering' || isPreviewModalOpen) return;

      if (e.code === 'Space' && (clips.length > 0 || audioClips.length > 0)) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleSplitAtPlayhead();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    clips.length,
    audioClips.length,
    exportStatus,
    isPreviewModalOpen,
    handleSplitAtPlayhead,
  ]);

  const handleStartExport = useCallback(async () => {
    if (
      (clips.length === 0 && audioClips.length === 0) ||
      exportStatus === 'rendering'
    ) {
      return;
    }

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
        format: exportFormat,
        colorGrade,
        particleOverlay,
        intro,
        outro,
        audioClips,
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
    clips.length,
    audioClips,
    exportStatus,
    exportResult,
    plan,
    themeId,
    aspectRatio,
    resolution,
    exportFormat,
    colorGrade,
    particleOverlay,
    intro,
    outro,
  ]);

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
  }, []);

  const selectedVideoClip = useMemo(() => {
    if (selection?.type === 'clip') {
      return clips.find((c) => c.id === selection.id) ?? null;
    }
    return null;
  }, [selection, clips]);

  const selectedScheduleItem = useMemo(() => {
    if (!selectedVideoClip) return null;
    return (
      plan.schedule.find((item) => item.clip.id === selectedVideoClip.id) ??
      null
    );
  }, [plan.schedule, selectedVideoClip]);

  const selectedAudioClip = useMemo(() => {
    if (selection?.type === 'audio') {
      return audioClips.find((a) => a.id === selection.id) ?? null;
    }
    return null;
  }, [selection, audioClips]);

  const isExporting = exportStatus === 'rendering';
  const hasContent = clips.length > 0 || audioClips.length > 0;

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
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
        canExport={hasContent}
        isExporting={isExporting}
        exportFormat={exportFormat}
        onExportClick={handleStartExport}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4">
        {/* 3-Column Pro NLE Workspace: Media Bin | Program Stage | Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px] xl:grid-cols-[280px_minmax(0,1fr)_380px] gap-4 items-stretch">
          <MediaBin
            assets={assets}
            isExporting={isExporting}
            onOpenImportPicker={handleOpenFilePicker}
            onFilesDropped={(files) => handleFilesAdded(files)}
            onLoadSamples={handleLoadSamples}
            onResetProject={handleResetProject}
            onAddAssetToTimeline={(asset) => handleAddAssetToTimeline(asset)}
            onRemoveAsset={handleRemoveAsset}
          />

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
            audioClipsCount={audioClips.length}
            hasClips={hasContent}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onRestart={() => {
              handleSeek(0);
              setIsPlaying(true);
            }}
            onSeek={handleSeek}
            onAspectRatioChange={(ratio) => {
              setAspectRatio(ratio);
              setExportStatus('idle');
            }}
            onFilesDropped={(files) => handleFilesAdded(files)}
            onOpenFilePicker={handleOpenFilePicker}
            onLoadSamples={handleLoadSamples}
            externalExportCanvas={liveExportCanvas}
          />

          <StudioControls
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedTheme={themeId}
            totalDurationSec={plan.totalDuration}
            clipCount={clips.length}
            audioClipsCount={audioClips.length}
            resolution={resolution}
            exportFormat={exportFormat}
            selection={selection}
            selectedVideoClip={selectedVideoClip}
            selectedScheduleItem={selectedScheduleItem}
            selectedAudioClip={selectedAudioClip}
            currentTimeSec={currentTimeSec}
            colorGrade={colorGrade}
            particleOverlay={particleOverlay}
            intro={intro}
            outro={outro}
            exportStatus={exportStatus}
            exportProgressPct={exportProgressPct}
            exportElapsedSec={exportElapsedSec}
            exportError={exportError}
            exportResult={exportResult}
            onSelectTheme={(id) => {
              setThemeId(id);
              setExportStatus('idle');
            }}
            onFitTotalDuration={handleFitTotalDuration}
            onResolutionChange={(res) => {
              setResolution(res);
              setExportStatus('idle');
            }}
            onFormatChange={(fmt) => {
              setExportFormat(fmt);
              setExportStatus('idle');
            }}
            onUpdateVideoClip={handleUpdateVideoClip}
            onUpdateAudioClip={handleUpdateAudioClip}
            onDeleteAudioClip={handleDeleteAudioClip}
            onSplitAtPlayhead={handleSplitAtPlayhead}
            onApplyAnimationToAll={handleApplyAnimationToAll}
            onApplyTransitionToAll={handleApplyTransitionToAll}
            onResetAllClipOverrides={handleResetAllClipOverrides}
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
            onUploadAudioFile={handleUploadAudioFile}
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

        {/* Multi-Track NLE Timeline (Track V1 Video/Photos + Track A1 Song Clips) */}
        <TimelineEditor
          plan={plan}
          clips={clips}
          audioClips={audioClips}
          assets={assets}
          selection={selection}
          currentTimeSec={currentTimeSec}
          isExporting={isExporting}
          onSeek={handleSeek}
          onSelectTarget={handleSelectTarget}
          onSplitAtPlayhead={handleSplitAtPlayhead}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={handleDeleteSelected}
          onReorderVideoClip={handleReorderVideoClip}
          onTrimVideoClip={handleUpdateVideoClip}
          onUpdateAudioClip={handleUpdateAudioClip}
          onDropAssetToVideoTrack={handleDropAssetToVideoTrack}
          onDropAssetToAudioTrack={handleDropAssetToAudioTrack}
          onDropFiles={handleFilesAdded}
          onOpenImportPicker={handleOpenFilePicker}
        />
      </main>

      <Footer />

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
