import {
  AspectRatioId,
  ExportResolution,
  RenderPlan,
  SlideImage,
  SlideScheduleItem,
  ThemeConfig,
  ThemeId,
  TitleCardConfig,
} from '../types/studio';

export const THEMES: Record<ThemeId, ThemeConfig> = {
  cinematic: {
    id: 'cinematic',
    name: 'Cinematic',
    summary: 'Ken Burns, 3D parallax, dip-to-black & blur dissolves',
    accentHex: '#F2B705',
    baseTransitionDuration: 1.15,
    defaultFilter: 'cinematic',
    defaultParticle: 'film-dust',
    letterboxRatio: 0.085,
    vignetteStrength: 0.56,
    warmTint: 'rgba(20, 32, 46, 0.10)',
    innerBorderColor: null,
    animations: [
      'ken-burns-in',
      'parallax-depth',
      'ken-burns-out',
      'pan-right',
      'rotate-cw',
      'tilt-up',
    ],
    transitions: [
      'crossfade',
      'dip-black',
      'blur-dissolve',
      'wipe-diagonal',
      'cube-flip',
    ],
  },
  wedding: {
    id: 'wedding',
    name: 'Wedding',
    summary: 'Weightless float, ivory bloom, sparkles & soft reveals',
    accentHex: '#E8C5B0',
    baseTransitionDuration: 1.25,
    defaultFilter: 'warm',
    defaultParticle: 'sparkles',
    letterboxRatio: 0,
    vignetteStrength: 0.24,
    warmTint: 'rgba(255, 240, 224, 0.10)',
    innerBorderColor: 'rgba(255, 248, 238, 0.36)',
    animations: [
      'float-bob',
      'breathe-pulse',
      'rise-drift',
      'ken-burns-in',
      'rotate-ccw',
      'parallax-depth',
    ],
    transitions: [
      'bloom-ivory',
      'circle-reveal',
      'crossfade',
      'blur-dissolve',
      'page-flip',
    ],
  },
  travel: {
    id: 'travel',
    name: 'Travel',
    summary: 'Panorama pans, 3D cube flips, wipes & directional slides',
    accentHex: '#38BDF8',
    baseTransitionDuration: 0.78,
    defaultFilter: 'vivid',
    defaultParticle: 'none',
    letterboxRatio: 0,
    vignetteStrength: 0.2,
    warmTint: 'rgba(255, 238, 204, 0.04)',
    innerBorderColor: null,
    animations: [
      'pan-right',
      'tilt-up',
      'pan-left',
      'parallax-depth',
      'swing-pendulum',
      'tilt-down',
    ],
    transitions: [
      'slide-left',
      'cube-flip',
      'wipe-left',
      'slide-up',
      'blinds-venetian',
      'diamond-reveal',
    ],
  },
  party: {
    id: 'party',
    label: 'Party',
    name: 'Party',
    summary: 'Photo flick, stomp slam, glitch cuts, confetti & bokeh',
    accentHex: '#FB7185',
    baseTransitionDuration: 0.52,
    defaultFilter: 'vivid',
    defaultParticle: 'confetti',
    letterboxRatio: 0,
    vignetteStrength: 0.32,
    warmTint: 'rgba(244, 63, 94, 0.06)',
    innerBorderColor: null,
    animations: [
      'flick-stopmotion',
      'bounce-pop',
      'stomp-slam',
      'shake-energetic',
      'tumble-spin',
      'breathe-pulse',
    ],
    transitions: [
      'glitch-cut',
      'whip-pan',
      'flash-strobe',
      'zoom-through',
      'wipe-diagonal',
      'page-flip',
    ],
  } as ThemeConfig & { label?: string },
};

export const THEME_LIST: ThemeConfig[] = [
  THEMES.cinematic,
  THEMES.wedding,
  THEMES.travel,
  THEMES.party,
];

export function buildRenderPlan(
  slides: SlideImage[],
  themeId: ThemeId,
  totalDurationSec: number,
  intro: TitleCardConfig,
  outro: TitleCardConfig
): RenderPlan {
  const theme = THEMES[themeId];
  const count = slides.length;

  const maxTitleAllowance = Math.max(0, (totalDurationSec - 3.5) / 2);
  const introDur = intro.enabled
    ? Math.min(intro.durationSec, maxTitleAllowance, 4.5)
    : 0;
  const outroDur = outro.enabled
    ? Math.min(outro.durationSec, maxTitleAllowance, 4.5)
    : 0;

  const overlapFade = 0.45;
  const slidesStart = introDur > 0 ? Math.max(0, introDur - overlapFade) : 0;
  const slidesEnd =
    outroDur > 0
      ? Math.min(totalDurationSec, totalDurationSec - outroDur + overlapFade)
      : totalDurationSec;

  const slidesSpan = Math.max(1, slidesEnd - slidesStart);

  if (count === 0) {
    return {
      totalDuration: totalDurationSec,
      introStart: 0,
      introEnd: introDur,
      outroStart: totalDurationSec - outroDur,
      outroEnd: totalDurationSec,
      slidesStart,
      slidesEnd,
      transitionDuration: 0,
      stepDuration: 0,
      schedule: [],
    };
  }

  if (count === 1) {
    const slide = slides[0];
    const anim = slide.animationOverride ?? theme.animations[0];
    const trans = slide.transitionOverride ?? theme.transitions[0];
    return {
      totalDuration: totalDurationSec,
      introStart: 0,
      introEnd: introDur,
      outroStart: totalDurationSec - outroDur,
      outroEnd: totalDurationSec,
      slidesStart,
      slidesEnd,
      transitionDuration: 0,
      stepDuration: slidesSpan,
      schedule: [
        {
          index: 0,
          slide,
          startTime: slidesStart,
          endTime: slidesEnd,
          soloStartTime: slidesStart,
          transitionInDuration: 0,
          transitionOutDuration: 0,
          transitionOutType: trans,
          animationId: anim,
        },
      ],
    };
  }

  const maxAllowedTrans = (slidesSpan / count) * 0.42;
  const transDur = Math.min(theme.baseTransitionDuration, maxAllowedTrans);
  const step = (slidesSpan - transDur) / count;

  const schedule: SlideScheduleItem[] = slides.map((slide, index) => {
    const startTime = slidesStart + index * step;
    const endTime =
      index === count - 1
        ? slidesEnd
        : slidesStart + (index + 1) * step + transDur;
    const transitionInDuration = index === 0 ? 0 : transDur;
    const transitionOutDuration = index === count - 1 ? 0 : transDur;
    const animationId =
      slide.animationOverride ??
      theme.animations[index % theme.animations.length];
    const transitionOutType =
      slide.transitionOverride ??
      theme.transitions[index % theme.transitions.length];

    return {
      index,
      slide,
      startTime,
      endTime,
      soloStartTime: startTime + transitionInDuration,
      transitionInDuration,
      transitionOutDuration,
      transitionOutType,
      animationId,
    };
  });

  return {
    totalDuration: totalDurationSec,
    introStart: 0,
    introEnd: introDur,
    outroStart: totalDurationSec - outroDur,
    outroEnd: totalDurationSec,
    slidesStart,
    slidesEnd,
    transitionDuration: transDur,
    stepDuration: step,
    schedule,
  };
}

export function getDimensionsForAspect(
  aspectRatio: AspectRatioId,
  resolution: ExportResolution
): { width: number; height: number } {
  const is1080 = resolution === '1080p';
  switch (aspectRatio) {
    case '16:9':
      return is1080 ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
    case '9:16':
      return is1080 ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
    case '1:1':
      return is1080 ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  }
}
