import {
  AspectRatioId,
  AudioClip,
  ClipScheduleItem,
  ExportResolution,
  RenderPlan,
  ThemeConfig,
  ThemeId,
  TimelineClip,
  TitleCardConfig,
} from '../types/studio';

export const THEMES: Record<ThemeId, ThemeConfig> = {
  cinematic: {
    id: 'cinematic',
    name: 'Cinematic',
    summary: 'Ken Burns, 3D parallax, dip-to-black & blur dissolves',
    accentHex: '#38BDF8',
    baseTransitionDuration: 0.9,
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
    baseTransitionDuration: 1.0,
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
    baseTransitionDuration: 0.7,
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
    name: 'Party',
    summary: 'Photo flick, stomp slam, glitch cuts, confetti & bokeh',
    accentHex: '#60A5FA',
    baseTransitionDuration: 0.45,
    defaultFilter: 'vivid',
    defaultParticle: 'confetti',
    letterboxRatio: 0,
    vignetteStrength: 0.32,
    warmTint: 'rgba(56, 189, 248, 0.05)',
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
  },
};

export const THEME_LIST: ThemeConfig[] = [
  THEMES.cinematic,
  THEMES.wedding,
  THEMES.travel,
  THEMES.party,
];

export function buildRenderPlan(
  clips: TimelineClip[],
  themeId: ThemeId,
  intro: TitleCardConfig,
  outro: TitleCardConfig,
  audioClips: AudioClip[] = []
): RenderPlan {
  const theme = THEMES[themeId];
  const count = clips.length;

  const introDur = intro.enabled ? Math.max(0.8, Math.min(4.5, intro.durationSec)) : 0;
  const outroDur = outro.enabled ? Math.max(0.8, Math.min(4.5, outro.durationSec)) : 0;
  const overlapFade = 0.45;

  const slidesStart = introDur > 0 ? Math.max(0, introDur - overlapFade) : 0;

  if (count === 0) {
    const audioMaxEnd = audioClips.reduce(
      (max, ac) => Math.max(max, ac.startTime + ac.durationSec),
      0
    );
    const total = Math.max(10, introDur + outroDur, audioMaxEnd);
    return {
      totalDuration: Number(total.toFixed(2)),
      introStart: 0,
      introEnd: introDur,
      outroStart: outroDur > 0 ? total - outroDur : total,
      outroEnd: total,
      slidesStart,
      slidesEnd: slidesStart,
      schedule: [],
    };
  }

  const schedule: ClipScheduleItem[] = [];
  let cursor = slidesStart;

  for (let i = 0; i < count; i++) {
    const clip = clips[i];
    const nextClip = i < count - 1 ? clips[i + 1] : null;
    const prevItem = i > 0 ? schedule[i - 1] : null;

    const transIn = prevItem ? prevItem.transitionOutDuration : 0;
    const transOut = nextClip
      ? Math.min(
          theme.baseTransitionDuration,
          clip.durationSec * 0.38,
          nextClip.durationSec * 0.38
        )
      : 0;

    const startTime = cursor;
    const endTime = startTime + clip.durationSec;

    const animationId =
      clip.animationOverride ??
      theme.animations[i % theme.animations.length];
    const transitionOutType =
      clip.transitionOverride ??
      theme.transitions[i % theme.transitions.length];

    schedule.push({
      index: i,
      clip,
      startTime,
      endTime,
      soloStartTime: startTime + transIn,
      transitionInDuration: transIn,
      transitionOutDuration: transOut,
      transitionOutType,
      animationId,
    });

    cursor = endTime - transOut;
  }

  const slidesEnd = schedule[schedule.length - 1].endTime;
  const outroStart = outroDur > 0 ? Math.max(slidesStart, slidesEnd - overlapFade) : slidesEnd;
  const videoEnd = outroDur > 0 ? outroStart + outroDur : slidesEnd;
  const audioMaxEnd = audioClips.reduce(
    (max, ac) => Math.max(max, ac.startTime + ac.durationSec),
    0
  );
  const totalDuration = Number(Math.max(videoEnd, audioMaxEnd).toFixed(2));

  return {
    totalDuration,
    introStart: 0,
    introEnd: introDur,
    outroStart,
    outroEnd: outroDur > 0 ? outroStart + outroDur : totalDuration,
    slidesStart,
    slidesEnd,
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
