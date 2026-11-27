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
  const v1Clips = clips.filter((c) => (c.trackId || 'v1') === 'v1');
  const overlayClips = clips.filter((c) => (c.trackId || 'v1') !== 'v1');

  const introDur = intro.enabled ? Math.max(0.8, Math.min(4.5, intro.durationSec)) : 0;
  const outroDur = outro.enabled ? Math.max(0.8, Math.min(4.5, outro.durationSec)) : 0;
  const overlapFade = 0.45;

  const slidesStart = introDur > 0 ? Math.max(0, introDur - overlapFade) : 0;
  const trackSchedules: Record<string, ClipScheduleItem[]> = { v1: [] };

  // Schedule Track V1 sequentially with curated theme transitions
  const scheduleV1: ClipScheduleItem[] = [];
  let cursor = slidesStart;

  for (let i = 0; i < v1Clips.length; i++) {
    const clip = v1Clips[i];
    const nextClip = i < v1Clips.length - 1 ? v1Clips[i + 1] : null;
    const prevItem = i > 0 ? scheduleV1[i - 1] : null;

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

    scheduleV1.push({
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

  trackSchedules.v1 = scheduleV1;

  // Schedule parallel overlay video tracks (V2, V3, ...) by explicit startTime
  const byTrack = new Map<string, TimelineClip[]>();
  for (const clip of overlayClips) {
    const tId = clip.trackId || 'v2';
    const list = byTrack.get(tId) ?? [];
    list.push(clip);
    byTrack.set(tId, list);
  }

  let overlayMaxEnd = 0;
  for (const [tId, list] of byTrack.entries()) {
    const sorted = [...list].sort(
      (a, b) => (a.startTime ?? 0) - (b.startTime ?? 0)
    );
    const items: ClipScheduleItem[] = sorted.map((clip, i) => {
      const startTime = Math.max(0, clip.startTime ?? 0);
      const endTime = startTime + clip.durationSec;
      overlayMaxEnd = Math.max(overlayMaxEnd, endTime);
      const fade = Math.min(0.35, clip.durationSec * 0.2);
      const animationId =
        clip.animationOverride ??
        theme.animations[i % theme.animations.length];
      const transitionOutType =
        clip.transitionOverride ??
        theme.transitions[i % theme.transitions.length];

      return {
        index: i,
        clip,
        startTime,
        endTime,
        soloStartTime: startTime,
        transitionInDuration: fade,
        transitionOutDuration: fade,
        transitionOutType,
        animationId,
      };
    });
    trackSchedules[tId] = items;
  }

  const audioMaxEnd = audioClips.reduce(
    (max, ac) => Math.max(max, ac.startTime + ac.durationSec),
    0
  );

  if (v1Clips.length === 0) {
    const baseEnd = Math.max(
      overlayMaxEnd,
      audioMaxEnd,
      introDur + outroDur,
      clips.length === 0 && audioClips.length === 0 ? 10 : 1
    );
    const outroStart = outroDur > 0 ? Math.max(slidesStart, baseEnd - outroDur) : baseEnd;
    return {
      totalDuration: Number(baseEnd.toFixed(2)),
      introStart: 0,
      introEnd: introDur,
      outroStart,
      outroEnd: baseEnd,
      slidesStart,
      slidesEnd: overlayMaxEnd || slidesStart,
      schedule: [],
      trackSchedules,
    };
  }

  const slidesEnd = scheduleV1[scheduleV1.length - 1].endTime;
  const outroStart =
    outroDur > 0 ? Math.max(slidesStart, slidesEnd - overlapFade) : slidesEnd;
  const videoEnd = outroDur > 0 ? outroStart + outroDur : slidesEnd;
  const totalDuration = Number(
    Math.max(videoEnd, overlayMaxEnd, audioMaxEnd).toFixed(2)
  );

  return {
    totalDuration,
    introStart: 0,
    introEnd: introDur,
    outroStart,
    outroEnd: outroDur > 0 ? outroStart + outroDur : totalDuration,
    slidesStart,
    slidesEnd,
    schedule: scheduleV1,
    trackSchedules,
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
