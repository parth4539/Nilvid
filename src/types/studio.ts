export type ThemeId = 'cinematic' | 'wedding' | 'travel' | 'party';

export type AspectRatioId = '16:9' | '9:16' | '1:1';

export type ExportResolution = '720p' | '1080p';

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

export interface SlideImage {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  element: HTMLImageElement;
  isSample?: boolean;
  animationOverride?: AnimationId;
  transitionOverride?: TransitionId;
  caption?: string;
  captionPosition?: CaptionPosition;
  captionAnimation?: TextAnimationId;
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
  brightness: number; // 70 - 130 (default 100)
  contrast: number; // 70 - 140 (default 100)
  saturation: number; // 0 - 160 (default 100)
  vignette: number; // 0 - 100 (default -1 means theme auto, or 0..100 manual)
  useThemeVignette: boolean;
}

export interface AudioTrackConfig {
  fileName: string;
  url: string;
  buffer: AudioBuffer;
  durationSec: number;
  volume: number; // 0 - 1
  fadeInSec: number; // 0 - 5
  fadeOutSec: number; // 0 - 5
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

export interface SlideScheduleItem {
  index: number;
  slide: SlideImage;
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
  transitionDuration: number;
  stepDuration: number;
  schedule: SlideScheduleItem[];
}

export interface ExportResult {
  blobUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export type ExportStatus = 'idle' | 'rendering' | 'complete' | 'error';

export type InspectorTab = 'theme' | 'clip' | 'look' | 'titles';
