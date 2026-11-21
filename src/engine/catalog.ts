import {
  AnimationId,
  ColorFilterId,
  ColorGradeConfig,
  ParticleOverlayId,
  TextAnimationId,
  TransitionId,
} from '../types/studio';

export interface CatalogItem<T extends string> {
  id: T;
  label: string;
  category: string;
  description: string;
}

export const ANIMATION_CATALOG: CatalogItem<AnimationId>[] = [
  {
    id: 'ken-burns-in',
    label: 'Ken Burns In',
    category: 'Zoom',
    description: 'Slow cinema push-in with subtle drift',
  },
  {
    id: 'ken-burns-out',
    label: 'Ken Burns Out',
    category: 'Zoom',
    description: 'Gradual pull-back reveal across frame',
  },
  {
    id: 'pan-left',
    label: 'Pan Left',
    category: 'Pan',
    description: 'Steady horizontal sweep right to left',
  },
  {
    id: 'pan-right',
    label: 'Pan Right',
    category: 'Pan',
    description: 'Steady horizontal sweep left to right',
  },
  {
    id: 'tilt-up',
    label: 'Tilt Up',
    category: 'Pan',
    description: 'Vertical horizon lift across subject',
  },
  {
    id: 'tilt-down',
    label: 'Tilt Down',
    category: 'Pan',
    description: 'Vertical downward camera pan',
  },
  {
    id: 'rotate-cw',
    label: 'Rotate CW',
    category: 'Rotate',
    description: 'Gentle clockwise drift with slow zoom',
  },
  {
    id: 'rotate-ccw',
    label: 'Rotate CCW',
    category: 'Rotate',
    description: 'Counter-clockwise tilt with pull out',
  },
  {
    id: 'bounce-pop',
    label: 'Bounce Pop',
    category: 'Canva Pop',
    description: 'Elastic spring pop-in then smooth glide',
  },
  {
    id: 'float-bob',
    label: 'Weightless Float',
    category: 'Float',
    description: 'Organic sinusoidal hover and drift',
  },
  {
    id: 'parallax-depth',
    label: '3D Parallax Depth',
    category: 'Parallax',
    description: 'Layered foreground card over blurred backdrop',
  },
  {
    id: 'breathe-pulse',
    label: 'Breathe Pulse',
    category: 'Canva Pop',
    description: 'Rhythmic slow zoom-in and zoom-out pulse',
  },
  {
    id: 'stomp-slam',
    label: 'Stomp Slam',
    category: 'Canva Pop',
    description: 'Punchy impact drop with micro-shockwave',
  },
  {
    id: 'flick-stopmotion',
    label: 'Photo Flick',
    category: 'In-Place Flick',
    description: 'Stepped stop-motion snap & tilt flicker in place',
  },
  {
    id: 'swing-pendulum',
    label: 'Pendulum Swing',
    category: 'Rotate',
    description: 'Smooth rhythmic arc sway across center',
  },
  {
    id: 'tumble-spin',
    label: 'Tumble Spin',
    category: 'Rotate',
    description: 'Dynamic angled spin-in settling upright',
  },
  {
    id: 'shake-energetic',
    label: 'Beat Shake',
    category: 'In-Place Flick',
    description: 'High-energy handheld rhythm jitter',
  },
  {
    id: 'rise-drift',
    label: 'Rise & Settle',
    category: 'Float',
    description: 'Upward vertical entrance into steady zoom',
  },
];

export const TRANSITION_CATALOG: CatalogItem<TransitionId>[] = [
  {
    id: 'crossfade',
    label: 'Crossfade',
    category: 'Fade',
    description: 'Smooth alpha dissolve between frames',
  },
  {
    id: 'dip-black',
    label: 'Dip to Black',
    category: 'Fade',
    description: 'Cinema fade down to black and up',
  },
  {
    id: 'bloom-ivory',
    label: 'Ivory Bloom',
    category: 'Fade',
    description: 'Warm luminous exposure bloom fade',
  },
  {
    id: 'blur-dissolve',
    label: 'Blur Dissolve',
    category: 'Blur',
    description: 'Gaussian soft-focus cross-dissolve',
  },
  {
    id: 'wipe-left',
    label: 'Wipe Left',
    category: 'Wipe',
    description: 'Clean linear curtain wipe to the left',
  },
  {
    id: 'wipe-right',
    label: 'Wipe Right',
    category: 'Wipe',
    description: 'Clean linear curtain wipe to the right',
  },
  {
    id: 'wipe-diagonal',
    label: 'Diagonal Wipe',
    category: 'Wipe',
    description: 'Dynamic angled slash wipe reveal',
  },
  {
    id: 'blinds-venetian',
    label: 'Venetian Blinds',
    category: 'Wipe',
    description: 'Multi-slat vertical louver reveal',
  },
  {
    id: 'slide-left',
    label: 'Slide Left',
    category: 'Slide',
    description: 'Parallax push slide from right edge',
  },
  {
    id: 'slide-right',
    label: 'Slide Right',
    category: 'Slide',
    description: 'Parallax push slide from left edge',
  },
  {
    id: 'slide-up',
    label: 'Slide Up',
    category: 'Slide',
    description: 'Vertical lift slide from bottom edge',
  },
  {
    id: 'whip-pan',
    label: 'Whip Pan',
    category: 'Slide',
    description: 'High-speed lateral whip motion cut',
  },
  {
    id: 'cube-flip',
    label: '3D Cube Flip',
    category: '3D',
    description: 'Perspective 3D cube rotation with shading',
  },
  {
    id: 'page-flip',
    label: '3D Card Flip',
    category: '3D',
    description: 'Horizontal axis flip turning to next frame',
  },
  {
    id: 'circle-reveal',
    label: 'Circle Reveal',
    category: 'Shape',
    description: 'Expanding iris circle from frame center',
  },
  {
    id: 'diamond-reveal',
    label: 'Diamond Reveal',
    category: 'Shape',
    description: 'Expanding geometric diamond aperture',
  },
  {
    id: 'glitch-cut',
    label: 'Glitch Cut',
    category: 'FX',
    description: 'Sliced scanline shift with RGB flash',
  },
  {
    id: 'zoom-through',
    label: 'Zoom Through',
    category: 'Zoom',
    description: 'Hyper zoom-in warp into next photo',
  },
  {
    id: 'flash-strobe',
    label: 'Strobe Flash',
    category: 'FX',
    description: 'Bright camera flash pop at midpoint cut',
  },
];

export const COLOR_FILTERS: {
  id: ColorFilterId;
  label: string;
  filterCss: string;
  tintOverlay: string | null;
}[] = [
  {
    id: 'auto',
    label: 'Theme Auto',
    filterCss: '',
    tintOverlay: null,
  },
  {
    id: 'none',
    label: 'Original',
    filterCss: 'none',
    tintOverlay: null,
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    filterCss: 'contrast(1.1) saturate(0.92) brightness(0.97)',
    tintOverlay: 'rgba(18, 36, 52, 0.12)',
  },
  {
    id: 'vintage',
    label: 'Vintage Film',
    filterCss: 'sepia(0.32) contrast(0.96) brightness(1.02) saturate(0.86)',
    tintOverlay: 'rgba(180, 128, 72, 0.10)',
  },
  {
    id: 'bw',
    label: 'B&W Noir',
    filterCss: 'grayscale(1) contrast(1.18) brightness(0.98)',
    tintOverlay: null,
  },
  {
    id: 'warm',
    label: 'Warm Golden',
    filterCss: 'sepia(0.14) saturate(1.14) brightness(1.03)',
    tintOverlay: 'rgba(255, 198, 120, 0.09)',
  },
  {
    id: 'cool',
    label: 'Cool Crisp',
    filterCss: 'contrast(1.06) saturate(1.06) brightness(1.01) hue-rotate(-6deg)',
    tintOverlay: 'rgba(56, 189, 248, 0.07)',
  },
  {
    id: 'vivid',
    label: 'Vivid Pop',
    filterCss: 'contrast(1.14) saturate(1.3) brightness(1.03)',
    tintOverlay: null,
  },
];

export const PARTICLE_OVERLAYS: {
  id: ParticleOverlayId;
  label: string;
  description: string;
}[] = [
  { id: 'auto', label: 'Theme Auto', description: 'Follows selected theme look' },
  { id: 'none', label: 'None', description: 'Clean unobstructed footage' },
  { id: 'confetti', label: 'Confetti', description: 'Falling celebration ribbons' },
  { id: 'snow', label: 'Snowfall', description: 'Soft drifting winter flakes' },
  { id: 'sparkles', label: 'Sparkles', description: 'Twinkling golden light motes' },
  { id: 'bokeh', label: 'Party Bokeh', description: 'Floating warm & neon orbs' },
  { id: 'film-dust', label: 'Film Grain', description: 'Analog cinema grain & dust' },
];

export const TEXT_ANIMATIONS: { id: TextAnimationId; label: string }[] = [
  { id: 'fade-rise', label: 'Fade & Rise' },
  { id: 'kinetic-scale', label: 'Kinetic Pop' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'slide-left', label: 'Slide In' },
  { id: 'cinema-reveal', label: 'Cinema Reveal' },
];

export function getAnimationLabel(id: AnimationId): string {
  return ANIMATION_CATALOG.find((a) => a.id === id)?.label ?? id;
}

export function getTransitionLabel(id: TransitionId): string {
  return TRANSITION_CATALOG.find((t) => t.id === id)?.label ?? id;
}

export function buildCompositeFilterString(
  resolvedFilterId: Exclude<ColorFilterId, 'auto'>,
  grade: ColorGradeConfig
): { filter: string; tintOverlay: string | null } {
  const preset =
    COLOR_FILTERS.find((f) => f.id === resolvedFilterId) ?? COLOR_FILTERS[1];
  const baseFilter = preset.filterCss === 'none' ? '' : preset.filterCss;

  const userParts: string[] = [];
  if (grade.brightness !== 100) {
    userParts.push(`brightness(${(grade.brightness / 100).toFixed(2)})`);
  }
  if (grade.contrast !== 100) {
    userParts.push(`contrast(${(grade.contrast / 100).toFixed(2)})`);
  }
  if (grade.saturation !== 100) {
    userParts.push(`saturate(${(grade.saturation / 100).toFixed(2)})`);
  }

  const combined = [baseFilter, ...userParts].filter(Boolean).join(' ').trim();
  return {
    filter: combined || 'none',
    tintOverlay: preset.tintOverlay,
  };
}
