import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Film,
  Image as ImageIcon,
  Maximize2,
  Music,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getAnimationLabel, getTransitionLabel } from '../engine/catalog';
import { formatTimecode } from '../engine/exporter';
import {
  AudioClip,
  MediaAsset,
  RenderPlan,
  SelectionTarget,
  TimelineClip,
} from '../types/studio';

interface TimelineEditorProps {
  plan: RenderPlan;
  clips: TimelineClip[];
  audioClips: AudioClip[];
  assets: MediaAsset[];
  selection: SelectionTarget;
  currentTimeSec: number;
  isExporting: boolean;
  onSeek: (timeSec: number) => void;
  onSelectTarget: (target: SelectionTarget) => void;
  onSplitAtPlayhead: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onReorderVideoClip: (fromIndex: number, toIndex: number) => void;
  onTrimVideoClip: (clipId: string, patch: Partial<TimelineClip>) => void;
  onUpdateAudioClip: (audioClipId: string, patch: Partial<AudioClip>) => void;
  onDropAssetToVideoTrack: (assetId: string, insertIndex?: number) => void;
  onDropAssetToAudioTrack: (assetId: string, startTime: number) => void;
  onDropFiles: (files: FileList | File[], targetTrack: 'video' | 'audio', atTimeSec: number) => void;
  onOpenImportPicker: () => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  plan,
  clips,
  audioClips,
  assets,
  selection,
  currentTimeSec,
  isExporting,
  onSeek,
  onSelectTarget,
  onSplitAtPlayhead,
  onDuplicateSelected,
  onDeleteSelected,
  onReorderVideoClip,
  onTrimVideoClip,
  onUpdateAudioClip,
  onDropAssetToVideoTrack,
  onDropAssetToAudioTrack,
  onDropFiles,
  onOpenImportPicker,
}) => {
  const [pxPerSec, setPxPerSec] = useState<number>(56);
  const [draggedClipIndex, setDraggedClipIndex] = useState<number | null>(null);
  const [dragOverClipIndex, setDragOverClipIndex] = useState<number | null>(null);
  const [isScrubbingRuler, setIsScrubbingRuler] = useState(false);

  const trackScrollRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);

  const totalDur = Math.max(10, plan.totalDuration);
  const trackWidthPx = Math.max(820, Math.ceil((totalDur + 2) * pxPerSec));

  const computeTimeFromClientX = (clientX: number) => {
    const el = rulerRef.current;
    if (!el) return currentTimeSec;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, clientX - rect.left);
    return Math.max(0, Math.min(plan.totalDuration, x / pxPerSec));
  };

  useEffect(() => {
    if (!isScrubbingRuler) return;
    const onMove = (e: PointerEvent) => onSeek(computeTimeFromClientX(e.clientX));
    const onUp = () => setIsScrubbingRuler(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isScrubbingRuler, pxPerSec, plan.totalDuration]);

  // Pointer drag state for trimming V1/A1 edges or sliding A1 audio blocks
  const startAudioMoveDrag = (e: React.PointerEvent, clip: AudioClip) => {
    if (isExporting) return;
    e.stopPropagation();
    onSelectTarget({ type: 'audio', id: clip.id });
    const startX = e.clientX;
    const origStart = clip.startTime;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const nextStart = Math.max(0, Number((origStart + dx / pxPerSec).toFixed(2)));
      onUpdateAudioClip(clip.id, { startTime: nextStart });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startAudioTrimRight = (e: React.PointerEvent, clip: AudioClip) => {
    if (isExporting) return;
    e.stopPropagation();
    const startX = e.clientX;
    const origDur = clip.durationSec;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const nextDur = Math.max(0.5, Number((origDur + dx / pxPerSec).toFixed(2)));
      onUpdateAudioClip(clip.id, { durationSec: nextDur });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startAudioTrimLeft = (e: React.PointerEvent, clip: AudioClip) => {
    if (isExporting) return;
    e.stopPropagation();
    const startX = e.clientX;
    const origStart = clip.startTime;
    const origDur = clip.durationSec;
    const origOffset = clip.sourceOffsetSec;

    const onMove = (ev: PointerEvent) => {
      const dt = (ev.clientX - startX) / pxPerSec;
      const maxShift = origDur - 0.5;
      const clampedShift = Math.max(-origStart, Math.min(maxShift, dt));
      const nextStart = Math.max(0, Number((origStart + clampedShift).toFixed(2)));
      const nextDur = Math.max(0.5, Number((origDur - clampedShift).toFixed(2)));
      const nextOffset = Math.max(0, Number((origOffset + clampedShift).toFixed(2)));
      onUpdateAudioClip(clip.id, {
        startTime: nextStart,
        durationSec: nextDur,
        sourceOffsetSec: nextOffset,
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startVideoTrimRight = (e: React.PointerEvent, clip: TimelineClip) => {
    if (isExporting) return;
    e.stopPropagation();
    const startX = e.clientX;
    const origDur = clip.durationSec;
    const maxVideoDur =
      clip.kind === 'video'
        ? Math.max(0.5, (clip.sourceDurationSec - clip.sourceStartSec) / clip.speed)
        : 30;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const nextDur = Math.max(
        0.5,
        Math.min(maxVideoDur, Number((origDur + dx / pxPerSec).toFixed(2)))
      );
      onTrimVideoClip(clip.id, { durationSec: nextDur });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startVideoTrimLeft = (e: React.PointerEvent, clip: TimelineClip) => {
    if (isExporting) return;
    e.stopPropagation();
    const startX = e.clientX;
    const origDur = clip.durationSec;
    const origSourceStart = clip.sourceStartSec;

    const onMove = (ev: PointerEvent) => {
      const dt = (ev.clientX - startX) / pxPerSec;
      if (clip.kind === 'video') {
        const minShift = -origSourceStart / clip.speed;
        const maxShift = origDur - 0.5;
        const clampedDt = Math.max(minShift, Math.min(maxShift, dt));
        onTrimVideoClip(clip.id, {
          sourceStartSec: Math.max(0, Number((origSourceStart + clampedDt * clip.speed).toFixed(2))),
          durationSec: Math.max(0.5, Number((origDur - clampedDt).toFixed(2))),
        });
      } else {
        const nextDur = Math.max(0.5, Math.min(30, Number((origDur - dt).toFixed(2))));
        onTrimVideoClip(clip.id, { durationSec: nextDur });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleFitZoom = () => {
    const container = trackScrollRef.current;
    if (!container) return;
    const usableW = Math.max(400, container.clientWidth - 40);
    setPxPerSec(Math.max(20, Math.min(120, Math.floor(usableW / Math.max(5, plan.totalDuration)))));
  };

  // Ruler tick spacing
  const tickStepSec = pxPerSec >= 80 ? 1 : pxPerSec >= 40 ? 2 : 5;
  const ticks: number[] = [];
  for (let s = 0; s <= Math.ceil(totalDur + 2); s += tickStepSec) {
    ticks.push(s);
  }

  const canSplit = (() => {
    if (!selection) return false;
    if (selection.type === 'clip') {
      const item = plan.schedule.find((s) => s.clip.id === selection.id);
      if (!item) return false;
      return (
        currentTimeSec > item.startTime + 0.25 &&
        currentTimeSec < item.endTime - 0.25
      );
    }
    const aClip = audioClips.find((a) => a.id === selection.id);
    if (!aClip) return false;
    return (
      currentTimeSec > aClip.startTime + 0.25 &&
      currentTimeSec < aClip.startTime + aClip.durationSec - 0.25
    );
  })();

  return (
    <section
      id="timeline"
      aria-label="Multi-Track Timeline Editor"
      className="bg-[#0E1424] border border-slate-800/90 rounded-2xl overflow-hidden flex flex-col"
    >
      {/* NLE Timeline Toolbar */}
      <div className="px-4 py-3 border-b border-slate-800/90 bg-[#090E1B] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canSplit || isExporting}
            onClick={onSplitAtPlayhead}
            title="Split selected video, photo, or song clip at playhead (Shortcut: S)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-[#172554] border border-sky-500/30 text-sky-100 text-xs font-medium hover:bg-[#2563EB] hover:text-white disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap"
          >
            <Scissors className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Split Cut (S)</span>
          </button>

          <button
            type="button"
            disabled={!selection || isExporting}
            onClick={onDuplicateSelected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-[#0E1424] border border-slate-800 text-slate-300 text-xs font-medium hover:text-white hover:border-slate-700 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            disabled={!selection || isExporting}
            onClick={onDeleteSelected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-[#0E1424] border border-slate-800 text-slate-300 text-xs font-medium hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={onOpenImportPicker}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-[#0E1424] border border-slate-800 text-sky-300 text-xs font-medium hover:border-sky-500/40 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>+ Add Clips / Songs</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-400 whitespace-nowrap">
            Duration: <span className="text-slate-100">{formatTimecode(plan.totalDuration)}</span>
          </span>

          <div className="flex items-center gap-1 bg-[#070A12] border border-slate-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.max(20, z - 12))}
              aria-label="Zoom out timeline"
              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleFitZoom}
              aria-label="Fit timeline to width"
              className="px-2 h-7 rounded text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer"
            >
              <Maximize2 className="w-3 h-3 inline mr-1" aria-hidden="true" />
              Fit
            </button>
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.min(140, z + 12))}
              aria-label="Zoom in timeline"
              className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Track Workspace */}
      <div className="flex relative">
        {/* Track Labels Sidebar */}
        <div className="w-24 sm:w-28 shrink-0 bg-[#0A0F1D] border-r border-slate-800/90 flex flex-col select-none">
          <div className="h-8 border-b border-slate-800/90 px-3 flex items-center text-[11px] font-mono text-slate-500">
            Time
          </div>
          <div className="h-24 border-b border-slate-800/80 px-3 flex flex-col justify-center gap-0.5">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              <span>Track V1</span>
            </span>
            <span className="text-[10px] text-slate-500">Video & Photos</span>
          </div>
          <div className="h-20 px-3 flex flex-col justify-center gap-0.5">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
              <span>Track A1</span>
            </span>
            <span className="text-[10px] text-slate-500">Song Clips</span>
          </div>
        </div>

        {/* Scrollable Track Grid */}
        <div
          ref={trackScrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden bg-[#070A12] relative"
        >
          <div
            style={{ width: `${trackWidthPx}px` }}
            className="relative flex flex-col"
          >
            {/* Time Ruler */}
            <div
              ref={rulerRef}
              onPointerDown={(e) => {
                if (isExporting) return;
                setIsScrubbingRuler(true);
                onSeek(computeTimeFromClientX(e.clientX));
              }}
              className="h-8 border-b border-slate-800/90 bg-[#090E1B] relative cursor-pointer select-none"
            >
              {ticks.map((sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * pxPerSec}px` }}
                  className="absolute top-0 bottom-0 border-l border-slate-800 pl-1.5 flex items-center text-[10px] font-mono text-slate-500 pointer-events-none"
                >
                  {sec}s
                </div>
              ))}
            </div>

            {/* Track V1: Video Cuts & Photo Slides */}
            <div
              onDragOver={(e) => {
                if (
                  e.dataTransfer.types.includes('application/x-nilvid-asset') ||
                  e.dataTransfer.types.includes('Files')
                ) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const assetId = e.dataTransfer.getData('application/x-nilvid-asset');
                if (assetId) {
                  const asset = assets.find((a) => a.id === assetId);
                  if (asset && (asset.kind === 'image' || asset.kind === 'video')) {
                    onDropAssetToVideoTrack(assetId);
                  }
                  return;
                }
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onDropFiles(e.dataTransfer.files, 'video', currentTimeSec);
                }
              }}
              className="h-24 border-b border-slate-800/80 relative flex items-center"
            >
              {plan.schedule.length === 0 ? (
                <div className="px-6 text-xs text-slate-500">
                  Drag images or video clips here from the Media Bin
                </div>
              ) : (
                plan.schedule.map((item, idx) => {
                  const clip = item.clip;
                  const leftPx = item.startTime * pxPerSec;
                  const widthPx = Math.max(44, (item.endTime - item.startTime) * pxPerSec);
                  const isSelected =
                    selection?.type === 'clip' && selection.id === clip.id;
                  const isBeingDragged = draggedClipIndex === idx;
                  const isDropTarget =
                    dragOverClipIndex === idx && draggedClipIndex !== idx;

                  return (
                    <div
                      key={clip.id}
                      draggable={!isExporting}
                      onDragStart={(e) => {
                        if (isExporting) return;
                        setDraggedClipIndex(idx);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(idx));
                      }}
                      onDragOver={(e) => {
                        if (draggedClipIndex === null && !e.dataTransfer.types.includes('application/x-nilvid-asset')) {
                          return;
                        }
                        e.preventDefault();
                        if (draggedClipIndex !== null && dragOverClipIndex !== idx) {
                          setDragOverClipIndex(idx);
                        }
                      }}
                      onDrop={(e) => {
                        const assetId = e.dataTransfer.getData('application/x-nilvid-asset');
                        if (assetId) {
                          e.preventDefault();
                          e.stopPropagation();
                          onDropAssetToVideoTrack(assetId, idx);
                          return;
                        }
                        if (draggedClipIndex !== null) {
                          e.preventDefault();
                          e.stopPropagation();
                          if (draggedClipIndex !== idx) {
                            onReorderVideoClip(draggedClipIndex, idx);
                          }
                          setDraggedClipIndex(null);
                          setDragOverClipIndex(null);
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedClipIndex(null);
                        setDragOverClipIndex(null);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTarget({ type: 'clip', id: clip.id });
                        onSeek(item.soloStartTime);
                      }}
                      style={{
                        left: `${leftPx}px`,
                        width: `${widthPx}px`,
                      }}
                      className={`group absolute top-2 bottom-2 rounded-xl overflow-hidden border select-none transition-shadow cursor-pointer ${
                        isBeingDragged ? 'opacity-45' : ''
                      } ${
                        isDropTarget
                          ? 'border-[#38BDF8] ring-2 ring-[#38BDF8]/50'
                          : isSelected
                          ? 'border-[#38BDF8] ring-1 ring-[#38BDF8]/60 z-10'
                          : 'border-slate-700/90 hover:border-slate-500'
                      }`}
                    >
                      {/* Background Thumbnail */}
                      {clip.thumbnailUrl && (
                        <img
                          src={clip.thumbnailUrl}
                          alt={clip.name}
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#04070E]/95 via-[#070A12]/55 to-[#070A12]/70 pointer-events-none" />

                      {/* Clip Content */}
                      <div className="relative h-full px-3 py-1.5 flex flex-col justify-between pointer-events-none">
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-100 truncate">
                            {clip.kind === 'video' ? (
                              <Film className="w-3 h-3 text-sky-400 shrink-0" />
                            ) : (
                              <ImageIcon className="w-3 h-3 text-slate-300 shrink-0" />
                            )}
                            <span className="truncate">{clip.name}</span>
                          </span>
                          {(clip.kind === 'video' ? clip.speed !== 1 : clip.motionSpeed !== 1) && (
                            <span className="font-mono text-[10px] text-[#38BDF8] shrink-0">
                              {clip.kind === 'video'
                                ? `${clip.speed.toFixed(2).replace(/\.00$/, '')}x`
                                : `${clip.motionSpeed.toFixed(1)}x`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1 text-[10px] text-slate-300 font-mono">
                          <span className="truncate">
                            {clip.kind === 'video' && !clip.animationOverride
                              ? 'Video Cut'
                              : getAnimationLabel(item.animationId)}
                            {idx < plan.schedule.length - 1 &&
                              ` · ${getTransitionLabel(item.transitionOutType)}`}
                          </span>
                          <span className="shrink-0 text-slate-200">
                            {clip.durationSec.toFixed(1)}s
                          </span>
                        </div>
                      </div>

                      {/* Left & Right Trim Handles */}
                      <div
                        role="separator"
                        aria-label={`Trim start of ${clip.name}`}
                        onPointerDown={(e) => startVideoTrimLeft(e, clip)}
                        className="absolute inset-y-0 left-0 w-2 bg-transparent hover:bg-[#38BDF8]/80 cursor-ew-resize transition-colors"
                      />
                      <div
                        role="separator"
                        aria-label={`Trim end of ${clip.name}`}
                        onPointerDown={(e) => startVideoTrimRight(e, clip)}
                        className="absolute inset-y-0 right-0 w-2 bg-transparent hover:bg-[#38BDF8]/80 cursor-ew-resize transition-colors"
                      />
                    </div>
                  );
                })
              )}
            </div>

            {/* Track A1: Song & Audio Clips */}
            <div
              onDragOver={(e) => {
                if (
                  e.dataTransfer.types.includes('application/x-nilvid-asset') ||
                  e.dataTransfer.types.includes('Files')
                ) {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const rect = rulerRef.current?.getBoundingClientRect();
                const dropTime = rect
                  ? Math.max(0, Number(((e.clientX - rect.left) / pxPerSec).toFixed(2)))
                  : currentTimeSec;
                const assetId = e.dataTransfer.getData('application/x-nilvid-asset');
                if (assetId) {
                  onDropAssetToAudioTrack(assetId, dropTime);
                  return;
                }
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onDropFiles(e.dataTransfer.files, 'audio', dropTime);
                }
              }}
              className="h-20 relative flex items-center bg-[#060911]"
            >
              {audioClips.length === 0 ? (
                <div className="px-6 text-xs text-slate-500">
                  Drag a song clip here to score specific parts of your timeline
                </div>
              ) : (
                audioClips.map((aClip) => {
                  const leftPx = aClip.startTime * pxPerSec;
                  const widthPx = Math.max(44, aClip.durationSec * pxPerSec);
                  const isSelected =
                    selection?.type === 'audio' && selection.id === aClip.id;

                  return (
                    <div
                      key={aClip.id}
                      onPointerDown={(e) => startAudioMoveDrag(e, aClip)}
                      style={{
                        left: `${leftPx}px`,
                        width: `${widthPx}px`,
                      }}
                      className={`group absolute top-2 bottom-2 rounded-xl overflow-hidden border select-none cursor-grab active:cursor-grabbing ${
                        isSelected
                          ? 'bg-[#172554]/90 border-[#38BDF8] ring-1 ring-[#38BDF8]/60 z-10'
                          : 'bg-[#0F1B38]/90 border-indigo-500/40 hover:border-sky-400/70'
                      }`}
                    >
                      {/* Waveform Bars */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-x-2 bottom-1.5 top-6 flex items-end gap-[2px] opacity-55 pointer-events-none"
                      >
                        {aClip.waveformPeaks.map((peak, pIdx) => (
                          <div
                            key={pIdx}
                            className="flex-1 bg-sky-400 rounded-t-[1px]"
                            style={{ height: `${Math.round(peak * 100)}%` }}
                          />
                        ))}
                      </div>

                      {/* Song Label */}
                      <div className="relative px-3 pt-1 flex items-center justify-between gap-2 text-[11px] pointer-events-none">
                        <span className="font-medium text-sky-100 truncate flex items-center gap-1">
                          <Music className="w-3 h-3 text-sky-400 shrink-0" />
                          <span className="truncate">{aClip.name}</span>
                        </span>
                        <span className="font-mono text-[10px] text-sky-200/80 shrink-0">
                          {aClip.durationSec.toFixed(1)}s
                        </span>
                      </div>

                      {/* Trim Handles */}
                      <div
                        role="separator"
                        aria-label={`Trim start of ${aClip.name}`}
                        onPointerDown={(e) => startAudioTrimLeft(e, aClip)}
                        className="absolute inset-y-0 left-0 w-2 bg-transparent hover:bg-[#38BDF8] cursor-ew-resize"
                      />
                      <div
                        role="separator"
                        aria-label={`Trim end of ${aClip.name}`}
                        onPointerDown={(e) => startAudioTrimRight(e, aClip)}
                        className="absolute inset-y-0 right-0 w-2 bg-transparent hover:bg-[#38BDF8] cursor-ew-resize"
                      />
                    </div>
                  );
                })
              )}
            </div>

            {/* Vertical Playhead Needle */}
            <div
              style={{ left: `${currentTimeSec * pxPerSec}px` }}
              className="absolute top-0 bottom-0 w-[2px] bg-[#38BDF8] pointer-events-none z-20"
            >
              <div className="w-3 h-3 -ml-[5px] bg-[#38BDF8] rotate-45 -mt-1 rounded-[1px]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
