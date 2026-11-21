import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Music,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { formatTimecode } from '../engine/exporter';
import { renderFrame, syncTimelineVideos } from '../engine/renderer';
import {
  AspectRatioId,
  ColorGradeConfig,
  ParticleOverlayId,
  RenderPlan,
  ThemeId,
  TitleCardConfig,
} from '../types/studio';

interface PreviewStageProps {
  plan: RenderPlan;
  themeId: ThemeId;
  currentTimeSec: number;
  isPlaying: boolean;
  isExporting: boolean;
  exportProgressPct: number;
  aspectRatio: AspectRatioId;
  colorGrade: ColorGradeConfig;
  particleOverlay: ParticleOverlayId;
  intro: TitleCardConfig;
  outro: TitleCardConfig;
  audioClipsCount: number;
  hasClips: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (timeSec: number) => void;
  onAspectRatioChange: (ratio: AspectRatioId) => void;
  onFilesDropped: (files: FileList | File[]) => void;
  onOpenFilePicker: () => void;
  onLoadSamples: () => void;
  externalExportCanvas?: HTMLCanvasElement | null;
}

const ASPECT_OPTIONS: { id: AspectRatioId; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
];

export const PreviewStage: React.FC<PreviewStageProps> = ({
  plan,
  themeId,
  currentTimeSec,
  isPlaying,
  isExporting,
  exportProgressPct,
  aspectRatio,
  colorGrade,
  particleOverlay,
  intro,
  outro,
  audioClipsCount,
  hasClips,
  onTogglePlay,
  onRestart,
  onSeek,
  onAspectRatioChange,
  onFilesDropped,
  onOpenFilePicker,
  onLoadSamples,
  externalExportCanvas,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const durationSec = plan.totalDuration;

  const previewDims =
    aspectRatio === '16:9'
      ? { width: 1280, height: 720 }
      : aspectRatio === '9:16'
      ? { width: 720, height: 1280 }
      : { width: 900, height: 900 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (isExporting && externalExportCanvas) {
      ctx.drawImage(externalExportCanvas, 0, 0, canvas.width, canvas.height);
      return;
    }

    syncTimelineVideos(plan, currentTimeSec, isPlaying);
    renderFrame(
      ctx,
      canvas.width,
      canvas.height,
      plan,
      themeId,
      currentTimeSec,
      aspectRatio,
      colorGrade,
      particleOverlay,
      intro,
      outro
    );
  }, [
    plan,
    themeId,
    currentTimeSec,
    isPlaying,
    aspectRatio,
    colorGrade,
    particleOverlay,
    intro,
    outro,
    isExporting,
    externalExportCanvas,
  ]);

  const computeTimeFromPointer = (clientX: number) => {
    const el = scrubberRef.current;
    if (!el) return currentTimeSec;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * durationSec;
  };

  useEffect(() => {
    if (!isScrubbing) return;
    const handlePointerMove = (e: PointerEvent) => {
      onSeek(computeTimeFromPointer(e.clientX));
    };
    const handlePointerUp = () => {
      setIsScrubbing(false);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isScrubbing, durationSec]);

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      setIsDragOver(false);
      onFilesDropped(e.dataTransfer.files);
    }
  };

  const progressPct =
    durationSec > 0 ? Math.min(100, (currentTimeSec / durationSec) * 100) : 0;

  const stageBoxClass =
    aspectRatio === '16:9'
      ? 'w-full aspect-video max-h-[470px]'
      : aspectRatio === '9:16'
      ? 'h-[420px] sm:h-[470px] aspect-[9/16]'
      : 'h-[390px] sm:h-[450px] aspect-square';

  return (
    <section
      id="studio"
      aria-label="Program Video Preview"
      className="bg-[#0E1424] border border-slate-800/90 rounded-2xl overflow-hidden flex flex-col"
    >
      {/* Canvas Viewport Stage */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative bg-[#04070E] flex items-center justify-center p-3 sm:p-4 min-h-[300px] sm:min-h-[420px] transition-colors ${
          isDragOver ? 'ring-2 ring-inset ring-[#38BDF8] bg-slate-900/60' : ''
        }`}
      >
        {hasClips ? (
          <div
            className={`relative ${stageBoxClass} mx-auto rounded-lg overflow-hidden bg-black shadow-2xl ring-1 ring-sky-400/15 flex items-center justify-center`}
          >
            <canvas
              ref={canvasRef}
              width={previewDims.width}
              height={previewDims.height}
              onClick={onTogglePlay}
              className="w-full h-full object-contain cursor-pointer block"
              aria-label="Live timeline animation preview canvas"
            />

            {isExporting && (
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-md bg-slate-950/85 border border-sky-500/40 text-xs font-medium text-slate-100 flex items-center gap-2 pointer-events-none">
                <span className="font-mono text-[#38BDF8]">
                  REC {Math.round(exportProgressPct)}%
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span className="text-slate-300">Rendering in browser</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-md py-14 px-6 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#090E1B] border border-slate-800 flex items-center justify-center text-sky-400">
              <ImagePlus className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-semibold text-slate-100">
                Drop photos, videos, or songs to start
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Cut video clips, animate photos, score individual song sections,
                and export directly in your browser.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={onOpenFilePicker}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>Import Media</span>
              </button>
              <button
                type="button"
                onClick={onLoadSamples}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg bg-[#090E1B] border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-sky-400" aria-hidden="true" />
                <span>Load Sample Set</span>
              </button>
            </div>
          </div>
        )}

        {isDragOver && (
          <div className="absolute inset-0 bg-[#070A12]/80 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
            <div className="px-5 py-3 rounded-xl bg-[#0E1424] border border-[#38BDF8] text-slate-100 text-sm font-medium">
              Drop images, videos, or songs to add to timeline
            </div>
          </div>
        )}
      </div>

      {/* Transport & Scrubber Bar */}
      <div className="border-t border-slate-800/90 px-4 py-3 bg-[#0E1424] flex flex-col gap-2.5">
        <div
          ref={scrubberRef}
          role="slider"
          tabIndex={hasClips ? 0 : -1}
          aria-label="Program timeline scrubber"
          aria-valuemin={0}
          aria-valuemax={durationSec}
          aria-valuenow={Number(currentTimeSec.toFixed(1))}
          onPointerDown={(e) => {
            if (!hasClips || isExporting) return;
            setIsScrubbing(true);
            onSeek(computeTimeFromPointer(e.clientX));
          }}
          onKeyDown={(e) => {
            if (!hasClips || isExporting) return;
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              onSeek(Math.min(durationSec, currentTimeSec + 0.5));
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              onSeek(Math.max(0, currentTimeSec - 0.5));
            }
          }}
          className={`relative h-5 flex items-center group ${
            hasClips && !isExporting ? 'cursor-pointer' : 'opacity-40 pointer-events-none'
          }`}
        >
          <div className="relative w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2563EB] to-[#38BDF8]"
              style={{ width: `${progressPct}%` }}
            />
            {plan.schedule.slice(1).map((item) => {
              const leftPct = (item.startTime / durationSec) * 100;
              return (
                <div
                  key={item.clip.id}
                  className="absolute inset-y-0 w-[2px] bg-[#070A12]/90"
                  style={{ left: `${leftPct}%` }}
                />
              );
            })}
          </div>
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#38BDF8] ring-2 ring-[#070A12] transition-transform group-hover:scale-125 pointer-events-none"
            style={{ left: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={!hasClips || isExporting}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[38px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onRestart}
              disabled={!hasClips || isExporting}
              aria-label="Restart preview from beginning"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#090E1B] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
            </button>

            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSeek(Math.max(0, currentTimeSec - 0.5))}
                disabled={!hasClips || isExporting}
                aria-label="Step back half a second"
                className="inline-flex items-center justify-center w-8 h-9 rounded-lg bg-[#090E1B] border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onSeek(Math.min(durationSec, currentTimeSec + 0.5))}
                disabled={!hasClips || isExporting}
                aria-label="Step forward half a second"
                className="inline-flex items-center justify-center w-8 h-9 rounded-lg bg-[#090E1B] border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="pl-1 font-mono text-xs sm:text-sm text-slate-300 tracking-tight whitespace-nowrap">
              <span className="text-slate-100">{formatTimecode(currentTimeSec)}</span>
              <span className="text-slate-600 mx-1.5">/</span>
              <span className="text-slate-400">{formatTimecode(durationSec)}</span>
            </div>

            {audioClipsCount > 0 && (
              <div className="hidden xl:flex items-center gap-1.5 pl-2 text-xs text-slate-400">
                <Music className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" aria-hidden="true" />
                <span>
                  {audioClipsCount} {audioClipsCount === 1 ? 'song' : 'songs'}
                </span>
              </div>
            )}
          </div>

          <div
            role="group"
            aria-label="Video aspect ratio"
            className="inline-flex items-center p-1 rounded-lg bg-[#070A12] border border-slate-800"
          >
            {ASPECT_OPTIONS.map((option) => {
              const active = aspectRatio === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={isExporting}
                  onClick={() => onAspectRatioChange(option.id)}
                  className={`px-3 py-1 min-h-[30px] rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                    active
                      ? 'bg-[#172554] text-sky-200 border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
