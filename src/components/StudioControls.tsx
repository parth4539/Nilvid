import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Film,
  Music,
  Play,
  RotateCcw,
  Scissors,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ANIMATION_CATALOG,
  COLOR_FILTERS,
  PARTICLE_OVERLAYS,
  TEXT_ANIMATIONS,
  TRANSITION_CATALOG,
} from '../engine/catalog';
import { formatBytes } from '../engine/exporter';
import { THEME_LIST } from '../engine/themes';
import {
  AnimationId,
  AudioClip,
  CaptionPosition,
  ClipScheduleItem,
  ColorFilterId,
  ColorGradeConfig,
  ExportResolution,
  ExportResult,
  ExportStatus,
  InspectorTab,
  ParticleOverlayId,
  SelectionTarget,
  TextAnimationId,
  ThemeId,
  TimelineClip,
  TitleCardConfig,
  TransitionId,
} from '../types/studio';

interface StudioControlsProps {
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  selectedTheme: ThemeId;
  totalDurationSec: number;
  clipCount: number;
  audioClipsCount: number;
  resolution: ExportResolution;
  selection: SelectionTarget;
  selectedVideoClip: TimelineClip | null;
  selectedScheduleItem: ClipScheduleItem | null;
  selectedAudioClip: AudioClip | null;
  currentTimeSec: number;
  colorGrade: ColorGradeConfig;
  particleOverlay: ParticleOverlayId;
  intro: TitleCardConfig;
  outro: TitleCardConfig;
  exportStatus: ExportStatus;
  exportProgressPct: number;
  exportElapsedSec: number;
  exportError: string | null;
  exportResult: ExportResult | null;
  onSelectTheme: (theme: ThemeId) => void;
  onFitTotalDuration: (targetSeconds: number) => void;
  onResolutionChange: (res: ExportResolution) => void;
  onUpdateVideoClip: (clipId: string, patch: Partial<TimelineClip>) => void;
  onUpdateAudioClip: (audioClipId: string, patch: Partial<AudioClip>) => void;
  onDeleteAudioClip: (audioClipId: string) => void;
  onSplitAtPlayhead: () => void;
  onApplyAnimationToAll: (anim: AnimationId) => void;
  onApplyTransitionToAll: (trans: TransitionId) => void;
  onResetAllClipOverrides: () => void;
  onUpdateColorGrade: (patch: Partial<ColorGradeConfig>) => void;
  onResetColorGrade: () => void;
  onSelectParticleOverlay: (id: ParticleOverlayId) => void;
  onUpdateIntro: (patch: Partial<TitleCardConfig>) => void;
  onUpdateOutro: (patch: Partial<TitleCardConfig>) => void;
  onUploadAudioFile: (file: File) => void;
  onStartExport: () => void;
  onCancelExport: () => void;
  onDownloadResult: () => void;
  onOpenPreviewModal: () => void;
}

const DURATION_PRESETS = [10, 15, 30, 45, 60];
const VIDEO_SPEED_PRESETS = [0.5, 1, 1.5, 2];

const CAPTION_POSITIONS: { id: CaptionPosition; label: string }[] = [
  { id: 'bottom-center', label: 'Bottom Center' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'top-center', label: 'Top Center' },
  { id: 'center', label: 'Center' },
];

const ANIM_CATEGORIES = [
  'All',
  'Zoom',
  'Pan',
  'Rotate',
  'Canva Pop',
  'In-Place Flick',
  'Float',
  'Parallax',
];

function renderThemeSwatch(id: ThemeId) {
  switch (id) {
    case 'cinematic':
      return (
        <div className="w-9 h-6 rounded bg-slate-950 border border-slate-700/80 relative overflow-hidden shrink-0 flex flex-col justify-between">
          <div className="h-1 bg-black w-full" />
          <div className="flex-1 bg-gradient-to-r from-blue-500/30 via-sky-700/35 to-amber-500/20" />
          <div className="h-1 bg-black w-full" />
        </div>
      );
    case 'wedding':
      return (
        <div className="w-9 h-6 rounded bg-[#231d19] border border-[#e8c5b0]/50 relative overflow-hidden shrink-0 p-0.5">
          <div className="w-full h-full border border-[#fff3e6]/45 rounded-[2px] bg-gradient-to-br from-[#fff5eb]/20 to-transparent" />
        </div>
      );
    case 'travel':
      return (
        <div className="w-9 h-6 rounded bg-[#0c1d29] border border-sky-400/40 relative overflow-hidden shrink-0 flex items-center">
          <div className="w-1/2 h-full bg-gradient-to-br from-sky-400/35 to-cyan-400/20" />
          <div className="w-[1px] h-full bg-white/40" />
          <div className="w-1/2 h-full bg-gradient-to-br from-blue-400/25 to-sky-500/30" />
        </div>
      );
    case 'party':
      return (
        <div className="w-9 h-6 rounded bg-[#151226] border border-indigo-400/45 relative overflow-hidden shrink-0">
          <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-rose-500/45 blur-[2px]" />
          <div className="absolute -bottom-1 right-0 w-4 h-4 rounded-full bg-sky-400/45 blur-[2px]" />
        </div>
      );
  }
}

export const StudioControls: React.FC<StudioControlsProps> = ({
  activeTab,
  onTabChange,
  selectedTheme,
  totalDurationSec,
  clipCount,
  audioClipsCount,
  resolution,
  selection,
  selectedVideoClip,
  selectedScheduleItem,
  selectedAudioClip,
  currentTimeSec,
  colorGrade,
  particleOverlay,
  intro,
  outro,
  exportStatus,
  exportProgressPct,
  exportElapsedSec,
  exportError,
  exportResult,
  onSelectTheme,
  onFitTotalDuration,
  onResolutionChange,
  onUpdateVideoClip,
  onUpdateAudioClip,
  onDeleteAudioClip,
  onSplitAtPlayhead,
  onApplyAnimationToAll,
  onApplyTransitionToAll,
  onResetAllClipOverrides,
  onUpdateColorGrade,
  onResetColorGrade,
  onSelectParticleOverlay,
  onUpdateIntro,
  onUpdateOutro,
  onUploadAudioFile,
  onStartExport,
  onCancelExport,
  onDownloadResult,
  onOpenPreviewModal,
}) => {
  const isExporting = exportStatus === 'rendering';
  const [animCategory, setAnimCategory] = useState<string>('All');
  const [fitLengthSlider, setFitLengthSlider] = useState<number>(
    Math.min(60, Math.max(10, Math.round(totalDurationSec)))
  );
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const filteredAnimations =
    animCategory === 'All'
      ? ANIMATION_CATALOG
      : ANIMATION_CATALOG.filter((a) => a.category === animCategory);

  const activeAnimationId =
    selectedVideoClip?.animationOverride ?? selectedScheduleItem?.animationId;
  const activeTransitionId =
    selectedVideoClip?.transitionOverride ?? selectedScheduleItem?.transitionOutType;

  const canSplitClip =
    selection?.type === 'clip' &&
    selectedScheduleItem &&
    currentTimeSec > selectedScheduleItem.startTime + 0.25 &&
    currentTimeSec < selectedScheduleItem.endTime - 0.25;

  const canSplitAudio =
    selection?.type === 'audio' &&
    selectedAudioClip &&
    currentTimeSec > selectedAudioClip.startTime + 0.25 &&
    currentTimeSec < selectedAudioClip.startTime + selectedAudioClip.durationSec - 0.25;

  return (
    <aside
      id="inspector"
      aria-label="Pro Studio Inspector"
      className="bg-[#0E1424] border border-slate-800/90 rounded-2xl overflow-hidden flex flex-col"
    >
      {/* Inspector Tab Bar */}
      <div
        role="tablist"
        aria-label="Editor Inspector Sections"
        className="grid grid-cols-4 gap-1 p-1.5 bg-[#090E1B] border-b border-slate-800/90"
      >
        {(
          [
            { id: 'clip', label: 'Clip' },
            { id: 'theme', label: 'Theme' },
            { id: 'look', label: 'Look & FX' },
            { id: 'titles', label: 'Titles' },
          ] as { id: InspectorTab; label: string }[]
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onTabChange(tab.id)}
              className={`py-2 px-1.5 min-h-[36px] rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                active
                  ? 'bg-[#172554] text-sky-100 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="p-4 sm:p-5 space-y-5 max-h-[540px] overflow-y-auto">
        {activeTab === 'clip' && (
          <div className="space-y-4">
            {selection?.type === 'audio' && selectedAudioClip ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-semibold text-slate-100 truncate flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">{selectedAudioClip.name}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Song Clip · Source {selectedAudioClip.sourceDurationSec.toFixed(1)}s
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => onDeleteAudioClip(selectedAudioClip.id)}
                    aria-label="Delete selected song clip"
                    className="w-8 h-8 rounded-lg bg-[#090E1B] border border-slate-800 text-slate-400 hover:text-rose-400 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!canSplitAudio || isExporting}
                  onClick={onSplitAtPlayhead}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg bg-[#172554] border border-sky-500/30 text-sky-100 text-xs font-medium hover:bg-[#2563EB] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Split Song at Playhead</span>
                </button>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Timeline Start</span>
                      <span className="font-mono text-sky-300">
                        {selectedAudioClip.startTime.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(30, Math.ceil(totalDurationSec))}
                      step={0.5}
                      disabled={isExporting}
                      value={selectedAudioClip.startTime}
                      onChange={(e) =>
                        onUpdateAudioClip(selectedAudioClip.id, {
                          startTime: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Clip Duration</span>
                      <span className="font-mono text-sky-300">
                        {selectedAudioClip.durationSec.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={Math.max(10, Math.ceil(selectedAudioClip.sourceDurationSec))}
                      step={0.5}
                      disabled={isExporting}
                      value={selectedAudioClip.durationSec}
                      onChange={(e) =>
                        onUpdateAudioClip(selectedAudioClip.id, {
                          durationSec: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Song Start Offset</span>
                      <span className="font-mono text-slate-200">
                        {selectedAudioClip.sourceOffsetSec.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, selectedAudioClip.sourceDurationSec - 1)}
                      step={0.5}
                      disabled={isExporting}
                      value={selectedAudioClip.sourceOffsetSec}
                      onChange={(e) =>
                        onUpdateAudioClip(selectedAudioClip.id, {
                          sourceOffsetSec: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Volume</span>
                      <span className="font-mono text-slate-200">
                        {Math.round(selectedAudioClip.volume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      disabled={isExporting}
                      value={Math.round(selectedAudioClip.volume * 100)}
                      onChange={(e) =>
                        onUpdateAudioClip(selectedAudioClip.id, {
                          volume: Number(e.target.value) / 100,
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Fade In</span>
                        <span className="font-mono text-slate-200">
                          {selectedAudioClip.fadeInSec.toFixed(1)}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.5}
                        disabled={isExporting}
                        value={selectedAudioClip.fadeInSec}
                        onChange={(e) =>
                          onUpdateAudioClip(selectedAudioClip.id, {
                            fadeInSec: Number(e.target.value),
                          })
                        }
                        className="studio-slider w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Fade Out</span>
                        <span className="font-mono text-slate-200">
                          {selectedAudioClip.fadeOutSec.toFixed(1)}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.5}
                        disabled={isExporting}
                        value={selectedAudioClip.fadeOutSec}
                        onChange={(e) =>
                          onUpdateAudioClip(selectedAudioClip.id, {
                            fadeOutSec: Number(e.target.value),
                          })
                        }
                        className="studio-slider w-full"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : selectedVideoClip ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-semibold text-slate-100 truncate">
                      {selectedScheduleItem ? `${selectedScheduleItem.index + 1}. ` : ''}
                      {selectedVideoClip.name}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedVideoClip.kind === 'video' ? 'Video Cut' : 'Photo Slide'} ·{' '}
                      {selectedVideoClip.durationSec.toFixed(1)}s
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={onResetAllClipOverrides}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#090E1B] border border-slate-800 text-[11px] text-slate-300 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Auto All</span>
                  </button>
                </div>

                {/* Split & Trim Controls */}
                <div className="p-3 rounded-xl bg-[#090E1B] border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      Timing & Speed
                    </span>
                    <button
                      type="button"
                      disabled={!canSplitClip || isExporting}
                      onClick={onSplitAtPlayhead}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#172554] text-sky-100 text-[11px] font-medium hover:bg-[#2563EB] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                    >
                      <Scissors className="w-3 h-3" aria-hidden="true" />
                      <span>Split Here</span>
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Clip Duration</span>
                      <span className="font-mono text-sky-300">
                        {selectedVideoClip.durationSec.toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={
                        selectedVideoClip.kind === 'video'
                          ? Math.max(
                              1,
                              Number(
                                (
                                  (selectedVideoClip.sourceDurationSec -
                                    selectedVideoClip.sourceStartSec) /
                                  selectedVideoClip.speed
                                ).toFixed(1)
                              )
                            )
                          : 20
                      }
                      step={0.5}
                      disabled={isExporting}
                      value={selectedVideoClip.durationSec}
                      onChange={(e) =>
                        onUpdateVideoClip(selectedVideoClip.id, {
                          durationSec: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>

                  {selectedVideoClip.kind === 'video' && (
                    <>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Trim In-Point</span>
                          <span className="font-mono text-slate-200">
                            {selectedVideoClip.sourceStartSec.toFixed(1)}s
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, selectedVideoClip.sourceDurationSec - 0.5)}
                          step={0.2}
                          disabled={isExporting}
                          value={selectedVideoClip.sourceStartSec}
                          onChange={(e) => {
                            const newStart = Number(e.target.value);
                            const maxDur = Math.max(
                              0.5,
                              (selectedVideoClip.sourceDurationSec - newStart) /
                                selectedVideoClip.speed
                            );
                            onUpdateVideoClip(selectedVideoClip.id, {
                              sourceStartSec: newStart,
                              durationSec: Math.min(selectedVideoClip.durationSec, maxDur),
                            });
                          }}
                          className="studio-slider w-full"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Playback Speed</span>
                          <span className="font-mono text-sky-300">
                            {selectedVideoClip.speed.toFixed(2).replace(/\.00$/, '')}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.25}
                          max={4}
                          step={0.25}
                          disabled={isExporting}
                          value={selectedVideoClip.speed}
                          onChange={(e) => {
                            const nextSpeed = Number(e.target.value);
                            const maxDur = Math.max(
                              0.5,
                              (selectedVideoClip.sourceDurationSec -
                                selectedVideoClip.sourceStartSec) /
                                nextSpeed
                            );
                            onUpdateVideoClip(selectedVideoClip.id, {
                              speed: nextSpeed,
                              durationSec: Math.min(selectedVideoClip.durationSec, maxDur),
                            });
                          }}
                          className="studio-slider w-full"
                        />
                        <div className="grid grid-cols-4 gap-1.5 mt-2">
                          {VIDEO_SPEED_PRESETS.map((spd) => (
                            <button
                              key={spd}
                              type="button"
                              disabled={isExporting}
                              onClick={() => {
                                const maxDur = Math.max(
                                  0.5,
                                  (selectedVideoClip.sourceDurationSec -
                                    selectedVideoClip.sourceStartSec) /
                                    spd
                                );
                                onUpdateVideoClip(selectedVideoClip.id, {
                                  speed: spd,
                                  durationSec: Math.min(selectedVideoClip.durationSec, maxDur),
                                });
                              }}
                              className={`py-1 rounded text-[11px] font-mono border cursor-pointer ${
                                selectedVideoClip.speed === spd
                                  ? 'bg-[#172554] border-sky-500/40 text-sky-100'
                                  : 'bg-[#0E1424] border-slate-800 text-slate-400'
                              }`}
                            >
                              {spd}x
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isExporting}
                          onClick={() =>
                            onUpdateVideoClip(selectedVideoClip.id, {
                              muted: !selectedVideoClip.muted,
                            })
                          }
                          aria-label={selectedVideoClip.muted ? 'Unmute video audio' : 'Mute video audio'}
                          className="w-8 h-8 rounded-lg bg-[#0E1424] border border-slate-800 text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
                        >
                          {selectedVideoClip.muted ? (
                            <VolumeX className="w-4 h-4 text-rose-400" />
                          ) : (
                            <Volume2 className="w-4 h-4 text-sky-400" />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          disabled={isExporting || selectedVideoClip.muted}
                          value={Math.round(selectedVideoClip.volume * 100)}
                          onChange={(e) =>
                            onUpdateVideoClip(selectedVideoClip.id, {
                              volume: Number(e.target.value) / 100,
                            })
                          }
                          className="studio-slider flex-1 disabled:opacity-40"
                        />
                      </div>
                    </>
                  )}

                  {/* Individual Animation Styling Speed */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Animation Speed</span>
                      <span className="font-mono text-sky-300">
                        {selectedVideoClip.motionSpeed.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.5}
                      step={0.25}
                      disabled={isExporting}
                      value={selectedVideoClip.motionSpeed}
                      onChange={(e) =>
                        onUpdateVideoClip(selectedVideoClip.id, {
                          motionSpeed: Number(e.target.value),
                        })
                      }
                      className="studio-slider w-full"
                    />
                  </div>
                </div>

                {/* 18 Frame Animations */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      Motion Preset (18)
                    </span>
                    {activeAnimationId && (
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => onApplyAnimationToAll(activeAnimationId)}
                        className="text-[11px] text-[#38BDF8] hover:underline cursor-pointer whitespace-nowrap"
                      >
                        Apply to all
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {ANIM_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setAnimCategory(cat)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          animCategory === cat
                            ? 'bg-[#172554] text-sky-100'
                            : 'bg-[#090E1B] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 max-h-[150px] overflow-y-auto pr-1">
                    {filteredAnimations.map((anim) => {
                      const active =
                        selectedVideoClip.kind === 'video'
                          ? selectedVideoClip.animationOverride === anim.id
                          : activeAnimationId === anim.id;
                      return (
                        <button
                          key={anim.id}
                          type="button"
                          disabled={isExporting}
                          title={anim.description}
                          onClick={() =>
                            onUpdateVideoClip(selectedVideoClip.id, {
                              animationOverride: anim.id,
                            })
                          }
                          className={`text-left px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                            active
                              ? 'bg-[#131F3A] border-[#38BDF8] text-slate-100'
                              : 'bg-[#090E1B] border-slate-800/80 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-medium truncate">{anim.label}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {anim.category}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 19 Transitions */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="slide-transition-select"
                      className="text-xs font-semibold text-slate-200"
                    >
                      Outgoing Transition (19)
                    </label>
                    {activeTransitionId && (
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => onApplyTransitionToAll(activeTransitionId)}
                        className="text-[11px] text-[#38BDF8] hover:underline cursor-pointer whitespace-nowrap"
                      >
                        Apply to all
                      </button>
                    )}
                  </div>
                  <select
                    id="slide-transition-select"
                    disabled={isExporting}
                    value={activeTransitionId ?? 'crossfade'}
                    onChange={(e) =>
                      onUpdateVideoClip(selectedVideoClip.id, {
                        transitionOverride: e.target.value as TransitionId,
                      })
                    }
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#38BDF8]"
                  >
                    {TRANSITION_CATALOG.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Individual Clip Color Filter Override */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="clip-filter-select"
                    className="text-xs font-semibold text-slate-200 block"
                  >
                    Individual Clip Color Style
                  </label>
                  <select
                    id="clip-filter-select"
                    disabled={isExporting}
                    value={selectedVideoClip.filterOverride ?? 'auto'}
                    onChange={(e) =>
                      onUpdateVideoClip(selectedVideoClip.id, {
                        filterOverride: e.target.value as ColorFilterId,
                      })
                    }
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#38BDF8]"
                  >
                    <option value="auto">Inherit Global Look</option>
                    {COLOR_FILTERS.filter((f) => f.id !== 'auto').map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Animated Caption */}
                <div className="space-y-2">
                  <label
                    htmlFor="slide-caption-input"
                    className="text-xs font-semibold text-slate-200 block"
                  >
                    Clip Animated Caption
                  </label>
                  <input
                    id="slide-caption-input"
                    type="text"
                    disabled={isExporting}
                    placeholder="Add caption overlay..."
                    value={selectedVideoClip.caption ?? ''}
                    onChange={(e) =>
                      onUpdateVideoClip(selectedVideoClip.id, {
                        caption: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#38BDF8]"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      aria-label="Caption position"
                      disabled={isExporting}
                      value={selectedVideoClip.captionPosition ?? 'bottom-center'}
                      onChange={(e) =>
                        onUpdateVideoClip(selectedVideoClip.id, {
                          captionPosition: e.target.value as CaptionPosition,
                        })
                      }
                      className="px-2.5 py-2 min-h-[34px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-[#38BDF8]"
                    >
                      {CAPTION_POSITIONS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Caption animation"
                      disabled={isExporting}
                      value={selectedVideoClip.captionAnimation ?? 'fade-rise'}
                      onChange={(e) =>
                        onUpdateVideoClip(selectedVideoClip.id, {
                          captionAnimation: e.target.value as TextAnimationId,
                        })
                      }
                      className="px-2.5 py-2 min-h-[34px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-[#38BDF8]"
                    >
                      {TEXT_ANIMATIONS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">
                Select any image, video cut, or song clip on the Timeline below
                to adjust speed, trim, styling, or captions.
              </p>
            )}
          </div>
        )}

        {activeTab === 'theme' && (
          <>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  Animation Theme
                </h2>
                <span className="text-xs text-slate-400">
                  Curated motion & FX mix
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {THEME_LIST.map((theme) => {
                  const active = selectedTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      disabled={isExporting}
                      onClick={() => onSelectTheme(theme.id)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] ${
                        active
                          ? 'bg-[#131F3A] border-[#38BDF8] text-slate-100'
                          : 'bg-[#090E1B] border-slate-800/90 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {renderThemeSwatch(theme.id)}
                        <span className="font-display text-sm font-semibold text-slate-100 whitespace-nowrap">
                          {theme.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {theme.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-slate-800/80" />

            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor="video-length-slider"
                  className="font-display text-sm font-semibold text-slate-100"
                >
                  Fit Sequence Length (10–60s)
                </label>
                <span className="font-mono text-sm font-medium text-[#38BDF8]">
                  {fitLengthSlider}s
                </span>
              </div>

              <input
                id="video-length-slider"
                type="range"
                min={10}
                max={60}
                step={1}
                disabled={isExporting || clipCount === 0}
                value={fitLengthSlider}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFitLengthSlider(val);
                  onFitTotalDuration(val);
                }}
                className="studio-slider w-full disabled:opacity-50"
              />

              <div
                role="group"
                aria-label="Quick duration presets"
                className="grid grid-cols-5 gap-1.5"
              >
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isExporting || clipCount === 0}
                    onClick={() => {
                      setFitLengthSlider(preset);
                      onFitTotalDuration(preset);
                    }}
                    className={`py-1.5 min-h-[34px] rounded-lg font-mono text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                      Math.round(totalDurationSec) === preset
                        ? 'bg-[#172554] border-sky-500/40 text-sky-100'
                        : 'bg-[#090E1B] border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {preset}s
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-400 font-mono">
                {clipCount} clips · {audioClipsCount} song{' '}
                {audioClipsCount === 1 ? 'clip' : 'clips'} · Total{' '}
                {totalDurationSec.toFixed(1)}s
              </p>
            </div>
          </>
        )}

        {activeTab === 'look' && (
          <div className="space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  Global Color Filter
                </h2>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={onResetColorGrade}
                  className="text-xs text-slate-400 hover:text-sky-300 cursor-pointer"
                >
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {COLOR_FILTERS.map((f) => {
                  const active = colorGrade.filter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={isExporting}
                      onClick={() => onUpdateColorGrade({ filter: f.id })}
                      className={`px-3 py-2 min-h-[38px] rounded-lg border text-left text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                        active
                          ? 'bg-[#131F3A] border-[#38BDF8] text-slate-100'
                          : 'bg-[#090E1B] border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-slate-800/80" />

            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-200">
                Color Adjustments
              </h3>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Brightness</span>
                  <span className="font-mono text-slate-200">
                    {colorGrade.brightness}%
                  </span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={130}
                  value={colorGrade.brightness}
                  disabled={isExporting}
                  onChange={(e) =>
                    onUpdateColorGrade({ brightness: Number(e.target.value) })
                  }
                  className="studio-slider w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Contrast</span>
                  <span className="font-mono text-slate-200">
                    {colorGrade.contrast}%
                  </span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={140}
                  value={colorGrade.contrast}
                  disabled={isExporting}
                  onChange={(e) =>
                    onUpdateColorGrade({ contrast: Number(e.target.value) })
                  }
                  className="studio-slider w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Saturation</span>
                  <span className="font-mono text-slate-200">
                    {colorGrade.saturation}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={160}
                  value={colorGrade.saturation}
                  disabled={isExporting}
                  onChange={(e) =>
                    onUpdateColorGrade({ saturation: Number(e.target.value) })
                  }
                  className="studio-slider w-full"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Vignette</span>
                  <span className="font-mono text-slate-200">
                    {colorGrade.useThemeVignette
                      ? 'Theme Auto'
                      : `${colorGrade.vignette}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={85}
                  value={colorGrade.vignette}
                  disabled={isExporting}
                  onChange={(e) =>
                    onUpdateColorGrade({
                      vignette: Number(e.target.value),
                      useThemeVignette: false,
                    })
                  }
                  className="studio-slider w-full"
                />
              </div>
            </div>

            <div className="h-px bg-slate-800/80" />

            <div className="space-y-2.5">
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Particle Overlays
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {PARTICLE_OVERLAYS.map((p) => {
                  const active = particleOverlay === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isExporting}
                      onClick={() => onSelectParticleOverlay(p.id)}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-50 ${
                        active
                          ? 'bg-[#131F3A] border-[#38BDF8] text-slate-100'
                          : 'bg-[#090E1B] border-slate-800/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-medium">{p.label}</div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {p.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'titles' && (
          <div className="space-y-5">
            {/* Title Intro Card */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  Title Intro Card
                </h2>
                <button
                  type="button"
                  role="switch"
                  aria-checked={intro.enabled}
                  disabled={isExporting}
                  onClick={() => onUpdateIntro({ enabled: !intro.enabled })}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    intro.enabled
                      ? 'bg-[#2563EB] border-[#2563EB] text-white'
                      : 'bg-[#090E1B] border-slate-800 text-slate-400'
                  }`}
                >
                  {intro.enabled ? 'Enabled' : 'Off'}
                </button>
              </div>

              {intro.enabled && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    aria-label="Intro title"
                    placeholder="Main Title"
                    disabled={isExporting}
                    value={intro.title}
                    onChange={(e) => onUpdateIntro({ title: e.target.value })}
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#38BDF8]"
                  />
                  <input
                    type="text"
                    aria-label="Intro subtitle"
                    placeholder="Subtitle or date"
                    disabled={isExporting}
                    value={intro.subtitle}
                    onChange={(e) => onUpdateIntro({ subtitle: e.target.value })}
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#38BDF8]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      aria-label="Intro text animation"
                      disabled={isExporting}
                      value={intro.animation}
                      onChange={(e) =>
                        onUpdateIntro({
                          animation: e.target.value as TextAnimationId,
                        })
                      }
                      className="px-2.5 py-2 min-h-[36px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-[#38BDF8]"
                    >
                      {TEXT_ANIMATIONS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Intro duration"
                      disabled={isExporting}
                      value={intro.durationSec}
                      onChange={(e) =>
                        onUpdateIntro({ durationSec: Number(e.target.value) })
                      }
                      className="px-2.5 py-2 min-h-[36px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#38BDF8]"
                    >
                      {[1.5, 2.0, 2.5, 3.0, 3.5].map((sec) => (
                        <option key={sec} value={sec}>
                          {sec.toFixed(1)}s intro
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-slate-800/80" />

            {/* Outro Card */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  Outro End Card
                </h2>
                <button
                  type="button"
                  role="switch"
                  aria-checked={outro.enabled}
                  disabled={isExporting}
                  onClick={() => onUpdateOutro({ enabled: !outro.enabled })}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                    outro.enabled
                      ? 'bg-[#2563EB] border-[#2563EB] text-white'
                      : 'bg-[#090E1B] border-slate-800 text-slate-400'
                  }`}
                >
                  {outro.enabled ? 'Enabled' : 'Off'}
                </button>
              </div>

              {outro.enabled && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    aria-label="Outro title"
                    placeholder="Closing Headline"
                    disabled={isExporting}
                    value={outro.title}
                    onChange={(e) => onUpdateOutro({ title: e.target.value })}
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#38BDF8]"
                  />
                  <input
                    type="text"
                    aria-label="Outro subtitle"
                    placeholder="Credits or call to action"
                    disabled={isExporting}
                    value={outro.subtitle}
                    onChange={(e) => onUpdateOutro({ subtitle: e.target.value })}
                    className="w-full px-3 py-2 min-h-[38px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#38BDF8]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      aria-label="Outro text animation"
                      disabled={isExporting}
                      value={outro.animation}
                      onChange={(e) =>
                        onUpdateOutro({
                          animation: e.target.value as TextAnimationId,
                        })
                      }
                      className="px-2.5 py-2 min-h-[36px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-[#38BDF8]"
                    >
                      {TEXT_ANIMATIONS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Outro duration"
                      disabled={isExporting}
                      value={outro.durationSec}
                      onChange={(e) =>
                        onUpdateOutro({ durationSec: Number(e.target.value) })
                      }
                      className="px-2.5 py-2 min-h-[36px] rounded-lg bg-[#090E1B] border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#38BDF8]"
                    >
                      {[1.5, 2.0, 2.5, 3.0, 3.5].map((sec) => (
                        <option key={sec} value={sec}>
                          {sec.toFixed(1)}s outro
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-slate-800/80" />

            {/* Quick Add Song Clip */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  Song Clips (Track A1)
                </h2>
                <span className="font-mono text-xs text-slate-400">
                  {audioClipsCount} active
                </span>
              </div>

              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onUploadAudioFile(file);
                    e.target.value = '';
                  }
                }}
              />

              <button
                type="button"
                disabled={isExporting}
                onClick={() => audioInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#090E1B] border border-dashed border-slate-700 hover:border-[#38BDF8] text-xs font-medium text-slate-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-sky-400" aria-hidden="true" />
                <span>Add Song Clip at Playhead</span>
              </button>
              <p className="text-[11px] text-slate-500">
                Add multiple songs, drag them onto specific timeline parts, and
                adjust individual volume & fades.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Export Footer inside Inspector */}
      <div
        id="export"
        className="border-t border-slate-800/90 p-4 sm:p-5 bg-[#0A0F1D] space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Render & Download
          </h2>

          <div
            role="group"
            aria-label="Export resolution"
            className="inline-flex items-center p-0.5 rounded-lg bg-[#070A12] border border-slate-800"
          >
            {(['720p', '1080p'] as ExportResolution[]).map((res) => {
              const active = resolution === res;
              return (
                <button
                  key={res}
                  type="button"
                  disabled={isExporting}
                  onClick={() => onResolutionChange(res)}
                  className={`px-2.5 py-1 min-h-[28px] rounded-md font-mono text-xs transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                    active
                      ? 'bg-[#172554] text-sky-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {res}
                </button>
              );
            })}
          </div>
        </div>

        {isExporting ? (
          <div className="p-3.5 rounded-xl bg-[#070A12] border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-200">
                Recording frames in browser...
              </span>
              <span className="font-mono text-[#38BDF8]">
                {Math.round(exportProgressPct)}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] transition-all duration-150"
                style={{ width: `${Math.min(100, exportProgressPct)}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-400">
                {exportElapsedSec.toFixed(1)}s / {totalDurationSec.toFixed(1)}s
              </span>
              <button
                type="button"
                onClick={onCancelExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-[#0E1424] border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartExport}
            disabled={clipCount === 0 && audioClipsCount === 0}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 min-h-[44px] rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
          >
            <Film className="w-4 h-4" aria-hidden="true" />
            <span>Export Video ({totalDurationSec.toFixed(1)}s)</span>
          </button>
        )}

        {exportStatus === 'error' && exportError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-2 text-xs text-rose-200"
          >
            <AlertCircle
              className="w-4 h-4 text-rose-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>{exportError}</span>
          </div>
        )}

        {exportStatus === 'complete' && exportResult && (
          <div className="p-3 rounded-xl bg-[#070A12] border border-sky-500/35 space-y-2.5">
            <div className="flex items-start gap-2">
              <CheckCircle2
                className="w-4 h-4 text-sky-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100 truncate">
                  {exportResult.filename}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {exportResult.width}×{exportResult.height} ·{' '}
                  {formatBytes(exportResult.sizeBytes)}
                  {exportResult.hasAudio ? ' · Audio' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDownloadResult}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={onOpenPreviewModal}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg bg-[#0E1424] border border-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Watch Video</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
