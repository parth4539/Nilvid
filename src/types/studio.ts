export type ThemeId = 'cinematic' | 'wedding' | 'travel' | 'party';

export type AspectRatioId = '16:9' | '9:16' | '1:1';

export type ExportResolution = '720p' | '1080p';

export type ExportFormat = 'mp4' | 'mov' | 'webm';

export type MediaKind = 'image' | 'video' | 'audio';

export type AnimationId =
  | 'ken-burns-in'
  | 'ken-burns-out'
  | 'pan-left'
  | 'pan-right'
  | 'tilt-up'
  | 'tilt-down'
  | 'rotate-cw'
  | 'rotate-ccw'
  | 'bounce-pop'
  | 'float-bob'
  | 'parallax-depth'
  | 'breathe-pulse'
  | 'stomp-slam'
  | 'flick-stopmotion'
  | 'swing-pendulum'
  | 'tumble-spin'
  | 'shake-energetic'
  | 'rise-drift';

export type TransitionId =
  | 'crossfade'
  | 'dip-black'
  | 'bloom-ivory'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-diagonal'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'whip-pan'
  | 'cube-flip'
  | 'page-flip'
  | 'circle-reveal'
  | 'diamond-reveal'
  | 'glitch-cut'
  | 'blur-dissolve'
  | 'zoom-through'
  | 'flash-strobe'
  | 'blinds-venetian';

export type ColorFilterId =
  | 'auto'
  | 'none'
  | 'cinematic'
  | 'vintage'
  | 'bw'
  | 'warm'
  | 'cool'
  | 'vivid';

export type ParticleOverlayId =
  | 'auto'
  | 'none'
  | 'confetti'
  | 'snow'
  | 'sparkles'
  | 'bokeh'
  | 'film-dust';

export type CaptionPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'top-center'
  | 'center';

export type TextAnimationId =
  | 'fade-rise'
  | 'kinetic-scale'
  | 'typewriter'
  | 'slide-left'
  | 'cinema-reveal';

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  name: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  durationSec: number; // default 5s for images, real duration for video/audio
  imageElement?: HTMLImageElement;
  audioBuffer?: AudioBuffer | null;
  waveformPeaks?: number[];
  isSample?: boolean;
}

export interface TimelineClip {
  id: string;
  assetId: string;
  kind: 'image' | 'video';
  name: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  imageElement?: HTMLImageElement;
  videoElement?: HTMLVideoElement;
  audioBuffer?: AudioBuffer | null;
  sourceDurationSec: number;
  sourceStartSec: number; // trim in-point inside source video
  durationSec: number; // duration on timeline
  speed: number; // video playback rate (0.25 - 4.0)
  motionSpeed: number; // image/frame animation speed multiplier (0.5 - 2.0)
  volume: number; // 0 - 1 for video clip native audio
  muted: boolean;
  animationOverride?: AnimationId;
  transitionOverride?: TransitionId;
  filterOverride?: ColorFilterId; // undefined or 'auto' means follow global Look
  brightnessOverride?: number;
  contrastOverride?: number;
  saturationOverride?: number;
  caption?: string;
  captionPosition?: CaptionPosition;
  captionAnimation?: TextAnimationId;
}

export interface AudioClip {
  id: string;
  assetId: string;
  name: string;
  buffer: AudioBuffer;
  waveformPeaks: number[];
  sourceDurationSec: number;
  startTime: number; // position on timeline in seconds
  durationSec: number; // length on timeline in seconds
  sourceOffsetSec: number; // start offset inside source audio
  volume: number; // 0 - 1
  fadeInSec: number; // 0 - 5
  fadeOutSec: number; // 0 - 5
}

export interface TitleCardConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  durationSec: number;
  animation: TextAnimationId;
}

export interface ColorGradeConfig {
  filter: ColorFilterId;
  brightness: number; // 70 - 130
  contrast: number; // 70 - 140
  saturation: number; // 0 - 160
  vignette: number; // 0 - 85
  useThemeVignette: boolean;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  summary: string;
  accentHex: string;
  baseTransitionDuration: number;
  defaultFilter: Exclude<ColorFilterId, 'auto'>;
  defaultParticle: Exclude<ParticleOverlayId, 'auto'>;
  letterboxRatio: number;
  vignetteStrength: number;
  warmTint: string | null;
  innerBorderColor: string | null;
  animations: AnimationId[];
  transitions: TransitionId[];
}

export interface ClipScheduleItem {
  index: number;
  clip: TimelineClip;
  startTime: number;
  endTime: number;
  soloStartTime: number;
  transitionInDuration: number;
  transitionOutDuration: number;
  transitionOutType: TransitionId;
  animationId: AnimationId;
}

export interface RenderPlan {
  totalDuration: number;
  introStart: number;
  introEnd: number;
  outroStart: number;
  outroEnd: number;
  slidesStart: number;
  slidesEnd: number;
  schedule: ClipScheduleItem[];
}

export type SelectionTarget =
  | { type: 'clip'; id: string }
  | { type: 'audio'; id: string }
  | null;

export interface ExportResult {
  blobUrl: string;
  filename: string;
  format: ExportFormat;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export type ExportStatus = 'idle' | 'rendering' | 'complete' | 'error';

export type InspectorTab = 'clip' | 'theme' | 'look' | 'titles';
