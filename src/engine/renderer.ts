import {
  AnimationId,
  AspectRatioId,
  CaptionPosition,
  ColorGradeConfig,
  ParticleOverlayId,
  RenderPlan,
  SlideScheduleItem,
  TextAnimationId,
  ThemeId,
  TitleCardConfig,
} from '../types/studio';
import { buildCompositeFilterString } from './catalog';
import { THEMES } from './themes';

let cachedGrainCanvas: HTMLCanvasElement | null = null;
let bufOut: HTMLCanvasElement | null = null;
let bufIn: HTMLCanvasElement | null = null;

function getGrainPatternCanvas(): HTMLCanvasElement {
  if (cachedGrainCanvas) return cachedGrainCanvas;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const gctx = c.getContext('2d');
  if (gctx) {
    const imgData = gctx.createImageData(c.width, c.height);
    const data = imgData.data;
    let seed = 1337;
    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const v = seed & 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    gctx.putImageData(imgData, 0, 0);
  }
  cachedGrainCanvas = c;
  return c;
}

function getTransitionBuffers(
  width: number,
  height: number
): { outCanvas: HTMLCanvasElement; inCanvas: HTMLCanvasElement } {
  if (!bufOut) bufOut = document.createElement('canvas');
  if (!bufIn) bufIn = document.createElement('canvas');
  if (bufOut.width !== width || bufOut.height !== height) {
    bufOut.width = width;
    bufOut.height = height;
  }
  if (bufIn.width !== width || bufIn.height !== height) {
    bufIn.width = width;
    bufIn.height = height;
  }
  return { outCanvas: bufOut, inCanvas: bufIn };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}

function easeOutExpo(t: number): number {
  const c = clamp(t, 0, 1);
  return c === 1 ? 1 : 1 - Math.pow(2, -10 * c);
}

function easeOutBack(t: number): number {
  const c = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
}

function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

interface AnimationTransform {
  scale: number;
  panX: number;
  panY: number;
  rotateDeg: number;
  parallaxMode?: boolean;
}

function evaluateAnimationTransform(
  animationId: AnimationId,
  rawProgress: number
): AnimationTransform {
  const p = clamp(rawProgress, 0, 1);
  const sineP = easeInOutSine(p);

  switch (animationId) {
    case 'ken-burns-in':
      return {
        scale: lerp(1.03, 1.18, sineP),
        panX: lerp(-0.02, 0.025, sineP),
        panY: lerp(0.01, -0.015, sineP),
        rotateDeg: 0,
      };
    case 'ken-burns-out':
      return {
        scale: lerp(1.18, 1.03, sineP),
        panX: lerp(0.025, -0.02, sineP),
        panY: lerp(-0.015, 0.015, sineP),
        rotateDeg: 0,
      };
    case 'pan-left':
      return {
        scale: 1.18,
        panX: lerp(0.065, -0.065, sineP),
        panY: 0,
        rotateDeg: 0,
      };
    case 'pan-right':
      return {
        scale: 1.18,
        panX: lerp(-0.065, 0.065, sineP),
        panY: 0,
        rotateDeg: 0,
      };
    case 'tilt-up':
      return {
        scale: 1.18,
        panX: 0,
        panY: lerp(0.06, -0.06, sineP),
        rotateDeg: 0,
      };
    case 'tilt-down':
      return {
        scale: 1.18,
        panX: 0,
        panY: lerp(-0.06, 0.06, sineP),
        rotateDeg: 0,
      };
    case 'rotate-cw':
      return {
        scale: lerp(1.08, 1.18, p),
        panX: 0,
        panY: 0,
        rotateDeg: lerp(-2.0, 2.2, sineP),
      };
    case 'rotate-ccw':
      return {
        scale: lerp(1.17, 1.08, p),
        panX: 0,
        panY: 0,
        rotateDeg: lerp(2.2, -2.0, sineP),
      };
    case 'bounce-pop': {
      const enter = p < 0.28 ? easeOutBack(p / 0.28) : 1;
      const baseScale = p < 0.28 ? lerp(0.86, 1.06, enter) : lerp(1.06, 1.13, (p - 0.28) / 0.72);
      return {
        scale: baseScale,
        panX: 0,
        panY: p < 0.28 ? lerp(0.04, 0, enter) : 0,
        rotateDeg: p < 0.28 ? lerp(-1.5, 0, enter) : 0,
      };
    }
    case 'float-bob':
      return {
        scale: lerp(1.09, 1.14, p),
        panX: Math.sin(p * Math.PI * 2) * 0.025,
        panY: Math.cos(p * Math.PI * 3) * 0.02,
        rotateDeg: Math.sin(p * Math.PI * 2) * 0.8,
      };
    case 'parallax-depth':
      return {
        scale: lerp(1.04, 1.14, sineP),
        panX: lerp(-0.04, 0.04, sineP),
        panY: lerp(0.015, -0.015, sineP),
        rotateDeg: 0,
        parallaxMode: true,
      };
    case 'breathe-pulse':
      return {
        scale: 1.08 + Math.sin(p * Math.PI * 4) * 0.045,
        panX: 0,
        panY: 0,
        rotateDeg: Math.sin(p * Math.PI * 2) * 0.6,
      };
    case 'stomp-slam': {
      if (p < 0.18) {
        const drop = easeOutExpo(p / 0.18);
        return {
          scale: lerp(1.38, 1.06, drop),
          panX: Math.sin(p * 95) * (1 - drop) * 0.015,
          panY: Math.cos(p * 85) * (1 - drop) * 0.015,
          rotateDeg: lerp(2.5, 0, drop),
        };
      }
      const rest = (p - 0.18) / 0.82;
      return {
        scale: lerp(1.06, 1.12, rest),
        panX: 0,
        panY: 0,
        rotateDeg: 0,
      };
    }
    case 'flick-stopmotion': {
      // Canva-style rhythmic in-place stepped flicker
      const step = Math.floor(p * 8);
      const scales = [1.05, 1.12, 1.07, 1.15, 1.06, 1.13, 1.08, 1.16];
      const angles = [-1.8, 1.5, -1.0, 2.0, -1.5, 1.2, -0.9, 1.7];
      const xShifts = [-0.015, 0.018, -0.01, 0.015, -0.018, 0.012, -0.014, 0.01];
      const yShifts = [0.012, -0.012, 0.016, -0.01, 0.012, -0.016, 0.01, -0.01];
      const idx = step % scales.length;
      return {
        scale: scales[idx],
        panX: xShifts[idx],
        panY: yShifts[idx],
        rotateDeg: angles[idx],
      };
    }
    case 'swing-pendulum':
      return {
        scale: 1.12,
        panX: Math.sin(p * Math.PI * 2.5) * 0.025,
        panY: -Math.abs(Math.cos(p * Math.PI * 2.5)) * 0.015,
        rotateDeg: Math.sin(p * Math.PI * 2.5) * 2.4,
      };
    case 'tumble-spin': {
      if (p < 0.34) {
        const t = easeOutCubic(p / 0.34);
        return {
          scale: lerp(0.9, 1.1, t),
          panX: 0,
          panY: 0,
          rotateDeg: lerp(-12, 0, t),
        };
      }
      return {
        scale: lerp(1.1, 1.15, (p - 0.34) / 0.66),
        panX: 0,
        panY: 0,
        rotateDeg: 0,
      };
    }
    case 'shake-energetic': {
      const jitterX = Math.sin(p * 42) * 0.012;
      const jitterY = Math.cos(p * 34) * 0.012;
      const jitterRot = Math.sin(p * 29) * 1.1;
      return {
        scale: lerp(1.08, 1.18, p),
        panX: jitterX,
        panY: jitterY,
        rotateDeg: jitterRot,
      };
    }
    case 'rise-drift': {
      const enter = easeOutCubic(Math.min(1, p / 0.45));
      return {
        scale: lerp(1.06, 1.16, p),
        panX: 0,
        panY: lerp(0.06, -0.03, enter),
        rotateDeg: 0,
      };
    }
  }
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  scale: number,
  panX: number,
  panY: number,
  rotateDeg: number,
  filter: string
) {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = width / height;

  let baseDrawW: number;
  let baseDrawH: number;
  if (imgAspect > canvasAspect) {
    baseDrawH = height;
    baseDrawW = height * imgAspect;
  } else {
    baseDrawW = width;
    baseDrawH = width / imgAspect;
  }

  const rotSafetyScale = Math.abs(rotateDeg) > 0.1 ? 1 + Math.abs(rotateDeg) * 0.018 : 1;
  const safeScale = Math.max(1.02, scale) * rotSafetyScale;
  const finalW = baseDrawW * safeScale;
  const finalH = baseDrawH * safeScale;

  const maxPanX = Math.max(0, (finalW - width) * 0.48);
  const maxPanY = Math.max(0, (finalH - height) * 0.48);
  const shiftX = clamp(panX * width, -maxPanX, maxPanX);
  const shiftY = clamp(panY * height, -maxPanY, maxPanY);

  ctx.save();
  if ('filter' in ctx) {
    ctx.filter = filter;
  }
  ctx.translate(width / 2 + shiftX, height / 2 + shiftY);
  if (rotateDeg !== 0) {
    ctx.rotate((rotateDeg * Math.PI) / 180);
  }
  ctx.drawImage(img, -finalW / 2, -finalH / 2, finalW, finalH);
  ctx.restore();
}

function drawSlideToContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  item: SlideScheduleItem,
  currentTimeSec: number,
  filterStr: string,
  tintOverlay: string | null
) {
  ctx.save();
  ctx.fillStyle = '#050506';
  ctx.fillRect(0, 0, width, height);

  const img = item.slide.element;
  if (!img || !img.naturalWidth || !img.naturalHeight) {
    ctx.restore();
    return;
  }

  const duration = Math.max(0.001, item.endTime - item.startTime);
  const rawProgress = clamp((currentTimeSec - item.startTime) / duration, 0, 1);
  const tf = evaluateAnimationTransform(item.animationId, rawProgress);

  if (tf.parallaxMode) {
    // Background blurred layer moving slower
    const bgFilter =
      filterStr && filterStr !== 'none'
        ? `${filterStr} blur(18px) brightness(0.65)`
        : 'blur(18px) brightness(0.65)';
    drawCoverImage(
      ctx,
      img,
      width,
      height,
      1.18,
      tf.panX * 0.4,
      tf.panY * 0.4,
      0,
      bgFilter
    );

    // Foreground elevated crisp layer moving faster
    const cardScale = 0.84;
    const cardW = width * cardScale;
    const cardH = height * cardScale;
    const cardX = (width - cardW) / 2 + tf.panX * width * 0.55;
    const cardY = (height - cardH) / 2 + tf.panY * height * 0.55;
    const radius = Math.round(Math.min(width, height) * 0.022);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = Math.round(width * 0.03);
    ctx.shadowOffsetY = Math.round(height * 0.015);
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.clip();
    ctx.translate(cardX, cardY);
    drawCoverImage(
      ctx,
      img,
      cardW,
      cardH,
      tf.scale,
      tf.panX * 0.5,
      tf.panY * 0.5,
      0,
      filterStr
    );
    ctx.restore();
  } else {
    drawCoverImage(
      ctx,
      img,
      width,
      height,
      tf.scale,
      tf.panX,
      tf.panY,
      tf.rotateDeg,
      filterStr
    );
  }

  if (tintOverlay) {
    ctx.fillStyle = tintOverlay;
    ctx.fillRect(0, 0, width, height);
  }

  // Per-slide animated caption
  if (item.slide.caption && item.slide.caption.trim().length > 0) {
    drawSlideCaption(
      ctx,
      width,
      height,
      item.slide.caption,
      item.slide.captionPosition ?? 'bottom-center',
      item.slide.captionAnimation ?? 'fade-rise',
      rawProgress,
      duration
    );
  }

  ctx.restore();
}

function drawSlideCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
  position: CaptionPosition,
  animation: TextAnimationId,
  rawProgress: number,
  slideDuration: number
) {
  const enterDur = Math.min(0.35, 0.7 / Math.max(1, slideDuration));
  const exitStart = Math.max(0.65, 1 - 0.5 / Math.max(1, slideDuration));

  let enterP = clamp(rawProgress / enterDur, 0, 1);
  let exitAlpha = rawProgress > exitStart ? 1 - clamp((rawProgress - exitStart) / (1 - exitStart), 0, 1) : 1;

  const easedEnter = easeOutCubic(enterP);
  let alpha = easedEnter * exitAlpha;
  let offsetY = 0;
  let offsetX = 0;
  let textScale = 1;
  let displayText = text;
  let clipRatio = 1;

  switch (animation) {
    case 'fade-rise':
      offsetY = (1 - easedEnter) * height * 0.035;
      break;
    case 'kinetic-scale':
      textScale = lerp(0.84, 1, easeOutBack(enterP));
      break;
    case 'typewriter': {
      const charCount = Math.max(1, Math.round(text.length * clamp(rawProgress / Math.min(0.6, enterDur * 1.6), 0, 1)));
      displayText = text.slice(0, charCount);
      alpha = exitAlpha;
      break;
    }
    case 'slide-left':
      offsetX = (1 - easedEnter) * width * 0.08;
      break;
    case 'cinema-reveal':
      clipRatio = easedEnter;
      alpha = exitAlpha;
      break;
  }

  if (alpha <= 0.01) return;

  const fontSize = Math.round(Math.min(width, height) * 0.042);
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.font = `600 ${fontSize}px "Outfit", "Plus Jakarta Sans", sans-serif`;
  ctx.textBaseline = 'middle';

  const padX = Math.round(fontSize * 0.75);
  const padY = Math.round(fontSize * 0.42);
  const metrics = ctx.measureText(displayText);
  const maxBoxW = width * 0.84;
  const boxW = Math.min(maxBoxW, metrics.width + padX * 2);
  const boxH = fontSize + padY * 2;

  let anchorX = width / 2;
  let anchorY = height * 0.84;
  let textAlign: CanvasTextAlign = 'center';

  if (position === 'bottom-left') {
    anchorX = width * 0.07 + boxW / 2;
    anchorY = height * 0.84;
  } else if (position === 'top-center') {
    anchorX = width / 2;
    anchorY = height * 0.14;
  } else if (position === 'center') {
    anchorX = width / 2;
    anchorY = height / 2;
  }

  ctx.translate(anchorX + offsetX, anchorY + offsetY);
  if (textScale !== 1) ctx.scale(textScale, textScale);

  if (clipRatio < 1) {
    ctx.beginPath();
    ctx.rect(-boxW / 2, -boxH / 2, boxW * clipRatio, boxH);
    ctx.clip();
  }

  // Soft dark backdrop scrim for 4.5:1 legibility across any photo
  ctx.fillStyle = 'rgba(9, 9, 11, 0.68)';
  ctx.beginPath();
  ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, Math.round(boxH * 0.22));
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = Math.max(1, width * 0.0012);
  ctx.stroke();

  ctx.fillStyle = '#FAFAFA';
  ctx.textAlign = textAlign;
  ctx.fillText(displayText, 0, 0, maxBoxW - padX * 1.4);
  ctx.restore();
}

function drawTitleCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  card: TitleCardConfig,
  progress: number,
  fadeAlpha: number,
  accentHex: string
) {
  if (fadeAlpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = clamp(fadeAlpha, 0, 1);

  // Cinema dark backdrop with radial accent glow
  ctx.fillStyle = '#070709';
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.6
  );
  glow.addColorStop(0, `${accentHex}24`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const enterP = easeOutCubic(clamp(progress / 0.42, 0, 1));
  const titleSize = Math.round(Math.min(width, height) * 0.072);
  const subSize = Math.round(Math.min(width, height) * 0.028);

  let titleText = card.title || 'Untitled Reel';
  let subText = card.subtitle || '';
  let offsetY = 0;
  let offsetX = 0;
  let scale = 1;

  if (card.animation === 'fade-rise') {
    offsetY = (1 - enterP) * height * 0.05;
  } else if (card.animation === 'kinetic-scale') {
    scale = lerp(0.86, 1, easeOutBack(clamp(progress / 0.42, 0, 1)));
  } else if (card.animation === 'slide-left') {
    offsetX = (1 - enterP) * width * 0.12;
  } else if (card.animation === 'typewriter') {
    const count = Math.max(1, Math.round(titleText.length * clamp(progress / 0.55, 0, 1)));
    titleText = titleText.slice(0, count);
  }

  ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
  if (scale !== 1) ctx.scale(scale, scale);

  if (card.animation === 'cinema-reveal') {
    ctx.beginPath();
    ctx.rect(-width * 0.45 * enterP, -height * 0.3, width * 0.9 * enterP, height * 0.6);
    ctx.clip();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Decorative accent rule
  const ruleW = Math.round(width * 0.07 * enterP);
  ctx.fillStyle = accentHex;
  ctx.fillRect(-ruleW / 2, -titleSize * 0.85, ruleW, Math.max(2, Math.round(height * 0.004)));

  ctx.fillStyle = '#F4F4F5';
  ctx.font = `700 ${titleSize}px "Outfit", sans-serif`;
  ctx.fillText(titleText, 0, subText ? -subSize * 0.55 : 0, width * 0.84);

  if (subText) {
    ctx.fillStyle = '#A1A1AA';
    ctx.font = `400 ${subSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(subText, 0, titleSize * 0.68, width * 0.78);
  }

  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particleId: Exclude<ParticleOverlayId, 'auto'>,
  timeSec: number
) {
  if (particleId === 'none') return;

  if (particleId === 'film-dust') {
    ctx.save();
    ctx.globalAlpha = 0.045;
    const grain = getGrainPatternCanvas();
    const pattern = ctx.createPattern(grain, 'repeat');
    if (pattern) {
      const ox = Math.floor((timeSec * 47) % grain.width);
      const oy = Math.floor((timeSec * 31) % grain.height);
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(ox, oy, width + grain.width, height + grain.height);
    }
    ctx.restore();
    return;
  }

  if (particleId === 'bokeh') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const count = 14;
    for (let i = 0; i < count; i++) {
      const seed = (i + 1) * 1.732;
      const speed = 0.25 + (i % 4) * 0.12;
      const px = ((Math.sin(seed * 3.1 + timeSec * speed) * 0.5 + 0.5) * 1.1 - 0.05) * width;
      const py = ((Math.cos(seed * 2.3 + timeSec * speed * 0.8) * 0.5 + 0.5) * 1.1 - 0.05) * height;
      const radius = width * (0.025 + (i % 5) * 0.014);
      const pulse = 0.08 + 0.06 * Math.sin(timeSec * 2.4 + i);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      const col =
        i % 3 === 0
          ? `rgba(251, 113, 133, ${pulse})`
          : i % 3 === 1
          ? `rgba(250, 204, 21, ${pulse * 0.9})`
          : `rgba(56, 189, 248, ${pulse * 0.85})`;
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (particleId === 'snow') {
    ctx.save();
    const count = 48;
    for (let i = 0; i < count; i++) {
      const seedX = ((i * 73.1) % 100) / 100;
      const seedY = ((i * 37.7) % 100) / 100;
      const fallSpeed = 0.09 + (i % 5) * 0.028;
      const x = ((seedX + Math.sin(timeSec * 1.3 + i) * 0.025 + 1) % 1) * width;
      const y = ((seedY + timeSec * fallSpeed) % 1) * height;
      const r = Math.max(1.5, width * (0.002 + (i % 4) * 0.001));
      ctx.fillStyle = `rgba(255, 255, 255, ${0.42 + (i % 3) * 0.16})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (particleId === 'confetti') {
    ctx.save();
    const colors = ['#F2B705', '#FB7185', '#38BDF8', '#34D399', '#A78BFA'];
    const count = 44;
    for (let i = 0; i < count; i++) {
      const seedX = ((i * 61.3) % 100) / 100;
      const seedY = ((i * 29.9) % 100) / 100;
      const speed = 0.14 + (i % 5) * 0.04;
      const x = ((seedX + Math.sin(timeSec * 2.2 + i) * 0.03 + 1) % 1) * width;
      const y = ((seedY + timeSec * speed) % 1) * height;
      const w = Math.max(5, width * 0.0075);
      const h = w * 0.55;
      const angle = timeSec * (2.5 + (i % 4)) + i;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(1, Math.cos(timeSec * 4 + i));
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.78;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  if (particleId === 'sparkles') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const count = 32;
    for (let i = 0; i < count; i++) {
      const x = (((i * 89.3 + 17) % 100) / 100) * width;
      const y = (((i * 53.7 + 11) % 100 - timeSec * (2 + (i % 3))) % 100 + 100) % 100 / 100 * height;
      const twinkle = Math.max(0, Math.sin(timeSec * (2.8 + (i % 4) * 0.7) + i * 1.9));
      if (twinkle < 0.15) continue;
      const size = width * (0.006 + (i % 3) * 0.003) * twinkle;

      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = `rgba(255, 240, 200, ${twinkle * 0.85})`;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.25, -size * 0.25);
      ctx.lineTo(size, 0);
      ctx.lineTo(size * 0.25, size * 0.25);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.25, size * 0.25);
      ctx.lineTo(-size, 0);
      ctx.lineTo(-size * 0.25, -size * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawGlobalOverlays(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  themeId: ThemeId,
  colorGrade: ColorGradeConfig,
  particleOverlay: ParticleOverlayId,
  timeSec: number,
  aspectRatio: AspectRatioId
) {
  const theme = THEMES[themeId];
  const resolvedParticle =
    particleOverlay === 'auto' ? theme.defaultParticle : particleOverlay;

  drawParticles(ctx, width, height, resolvedParticle, timeSec);

  // Vignette
  const vignetteStrength = colorGrade.useThemeVignette
    ? theme.vignetteStrength
    : colorGrade.vignette / 100;

  if (vignetteStrength > 0.01) {
    ctx.save();
    const outerRadius = Math.hypot(width, height) * 0.58;
    const innerRadius = outerRadius * 0.42;
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      innerRadius,
      width / 2,
      height / 2,
      outerRadius
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${clamp(vignetteStrength, 0, 0.88)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Delicate inner hairline frame for Wedding
  if (theme.innerBorderColor) {
    ctx.save();
    const inset = Math.round(Math.min(width, height) * 0.038);
    ctx.strokeStyle = theme.innerBorderColor;
    ctx.lineWidth = Math.max(1.5, Math.round(Math.min(width, height) * 0.0022));
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    ctx.restore();
  }

  // Cinema letterbox matte bars
  if (theme.letterboxRatio > 0) {
    const ratio = aspectRatio === '9:16' ? theme.letterboxRatio * 0.72 : theme.letterboxRatio;
    const barH = Math.round(height * ratio);
    ctx.save();
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, width, barH);
    ctx.fillRect(0, height - barH, width, barH);
    ctx.restore();
  }
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  plan: RenderPlan,
  themeId: ThemeId,
  currentTimeSec: number,
  aspectRatio: AspectRatioId,
  colorGrade: ColorGradeConfig,
  particleOverlay: ParticleOverlayId,
  intro: TitleCardConfig,
  outro: TitleCardConfig
): void {
  const theme = THEMES[themeId];
  const t = clamp(currentTimeSec, 0, plan.totalDuration);

  ctx.save();
  ctx.fillStyle = '#050506';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const resolvedFilter =
    colorGrade.filter === 'auto' ? theme.defaultFilter : colorGrade.filter;
  const { filter: filterStr, tintOverlay } = buildCompositeFilterString(
    resolvedFilter,
    colorGrade
  );
  const combinedTint = tintOverlay ?? (colorGrade.filter === 'auto' ? theme.warmTint : null);

  // Render slides if within slides span or schedule exists
  if (plan.schedule.length > 0) {
    let outgoing: SlideScheduleItem | null = null;
    let incoming: SlideScheduleItem | null = null;

    if (t <= plan.schedule[0].startTime) {
      outgoing = plan.schedule[0];
    } else if (t >= plan.schedule[plan.schedule.length - 1].endTime) {
      outgoing = plan.schedule[plan.schedule.length - 1];
    } else {
      for (let i = 0; i < plan.schedule.length; i++) {
        const item = plan.schedule[i];
        if (t >= item.startTime && t <= item.endTime) {
          if (!outgoing) {
            outgoing = item;
          } else {
            incoming = item;
            break;
          }
        }
      }
    }

    if (!outgoing) outgoing = plan.schedule[plan.schedule.length - 1];

    if (!incoming) {
      drawSlideToContext(ctx, width, height, outgoing, t, filterStr, combinedTint);
    } else {
      const transDur = Math.max(0.001, outgoing.endTime - incoming.startTime);
      const rawTrans = clamp((t - incoming.startTime) / transDur, 0, 1);
      const transType = outgoing.transitionOutType;

      const { outCanvas, inCanvas } = getTransitionBuffers(width, height);
      const outCtx = outCanvas.getContext('2d', { alpha: false });
      const inCtx = inCanvas.getContext('2d', { alpha: false });

      if (outCtx && inCtx) {
        drawSlideToContext(outCtx, width, height, outgoing, t, filterStr, combinedTint);
        drawSlideToContext(inCtx, width, height, incoming, t, filterStr, combinedTint);

        switch (transType) {
          case 'crossfade': {
            const p = smoothstep(rawTrans);
            ctx.drawImage(outCanvas, 0, 0);
            ctx.save();
            ctx.globalAlpha = p;
            ctx.drawImage(inCanvas, 0, 0);
            ctx.restore();
            break;
          }

          case 'dip-black': {
            if (rawTrans < 0.5) {
              const p = smoothstep(rawTrans * 2);
              ctx.save();
              ctx.globalAlpha = 1 - p * 0.92;
              ctx.drawImage(outCanvas, 0, 0);
              ctx.restore();
            } else {
              const p = smoothstep((rawTrans - 0.5) * 2);
              ctx.save();
              ctx.globalAlpha = 0.08 + p * 0.92;
              ctx.drawImage(inCanvas, 0, 0);
              ctx.restore();
            }
            break;
          }

          case 'bloom-ivory': {
            const p = smoothstep(rawTrans);
            ctx.drawImage(outCanvas, 0, 0);
            ctx.save();
            ctx.globalAlpha = p;
            ctx.drawImage(inCanvas, 0, 0);
            ctx.restore();
            const bloomAlpha = Math.sin(rawTrans * Math.PI) * 0.36;
            if (bloomAlpha > 0.005) {
              ctx.save();
              ctx.fillStyle = `rgba(255, 248, 236, ${bloomAlpha})`;
              ctx.fillRect(0, 0, width, height);
              ctx.restore();
            }
            break;
          }

          case 'blur-dissolve': {
            const p = smoothstep(rawTrans);
            const blurPx = Math.round(Math.sin(rawTrans * Math.PI) * Math.min(width, height) * 0.022);
            ctx.save();
            if ('filter' in ctx && blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
            ctx.drawImage(outCanvas, 0, 0);
            ctx.globalAlpha = p;
            ctx.drawImage(inCanvas, 0, 0);
            ctx.restore();
            break;
          }

          case 'wipe-left': {
            const p = easeInOutCubic(rawTrans);
            const splitX = width * (1 - p);
            ctx.drawImage(outCanvas, 0, 0);
            ctx.save();
            ctx.beginPath();
            ctx.rect(splitX, 0, width - splitX, height);
            ctx.clip();
            ctx.drawImage(inCanvas, 0, 0);
            ctx.restore();
            break;
          }

          case 'wipe-right': {
            const p = easeInOutCubic(rawTrans);
            const splitX = width * p;
            ctx.drawImage(outCanvas, 0, 0);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, splitX, height);
            ctx.clip();
            ctx.drawImage(inCanvas, 0, 0);
            ctx.restore();
            break;
          }

          case 'wipe-diagonal': {
            const p = easeInOutCubic(rawTrans);
            const xTop = lerp(-width * 0.4, width * 1.4, p);
            const xBot = xTop - width * 0.4;
            ctx.drawImage(outCanvas, 0, 0);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(xTop, 0);
            ctx.lineTo(xBot, height);
            ctx.lineTo(0, height);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(inCanvas, 0, 0);
            ctx.restore();
            break;
          }

          case 'blinds-venetian': {
            const p = easeInOutCubic(rawTrans);
            const slats = 8;
            const slatW = width / slats;
            ctx.drawImage(outCanvas, 0, 0);
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < slats; i++) {
              ctx.rect(i * slatW, 0, slatW * p + 1, height);
            }
            ctx.clip();
            ctx.drawImage(inCanvas, 0, 0);
            ctx.restore();
            break;
          }

          case 'slide-left': {
            const p = easeInOutCubic(rawTrans);
            ctx.drawImage(outCanvas, -p * width * 0.35, 0);
            ctx.save();
            ctx.fillStyle = `rgba(0,0,0,${p * 0.38})`;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            ctx.drawImage(inCanvas, (1 - p) * width, 0);
            break;
          }

          case 'slide-right': {
            const p = easeInOutCubic(rawTrans);
            ctx.drawImage(outCanvas, p * width * 0.35, 0);
            ctx.save();
            ctx.fillStyle = `rgba(0,0,0,${p * 0.38})`;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            ctx.drawImage(inCanvas, -(1 - p) * width, 0);
            break;
          }

          case 'slide-up': {
            const p = easeInOutCubic(rawTrans);
            ctx.drawImage(outCanvas, 0, -p * height * 0.35);
            ctx.save();
            ctx.fillStyle = `rgba(0,0,0,${p * 0.38})`;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
            ctx.drawImage(inCanvas, 0, (1 - p) * height);
            break;
          }

          case 'whip-pan': {
            const p = easeInOutQuart(rawTrans);
            ctx.drawImage(outCanvas, -p * width, 0);
            ctx.drawImage(inCanvas, (1 - p) * width, 0);
            break;
          }

          case 'cube-flip': {
            // 3D horizontal cube rotation with perspective face squeeze & lighting
            const p = easeInOutCubic(rawTrans);
            const splitX = width * (1 - p);
            const outW = splitX;
            const inW = width - splitX;

            if (outW > 1) {
              ctx.drawImage(outCanvas, 0, 0, width, height, 0, 0, outW, height);
              ctx.save();
              ctx.fillStyle = `rgba(0, 0, 0, ${p * 0.52})`;
              ctx.fillRect(0, 0, outW, height);
              ctx.restore();
            }
            if (inW > 1) {
              ctx.drawImage(inCanvas, 0, 0, width, height, splitX, 0, inW, height);
              ctx.save();
              ctx.fillStyle = `rgba(0, 0, 0, ${(1 - p) * 0.52})`;
              ctx.fillRect(splitX, 0, inW, height);
              ctx.restore();
            }
            break;
          }

          case 'page-flip': {
            const p = easeInOutCubic(rawTrans);
            const cosVal = Math.cos(p * Math.PI);
            const scaleX = Math.max(0.02, Math.abs(cosVal));
            const showIncoming = p >= 0.5;
            const source = showIncoming ? inCanvas : outCanvas;
            const drawW = width * scaleX;
            const drawX = (width - drawW) / 2;
            ctx.drawImage(source, 0, 0, width, height, drawX, 0, drawW, height);
            ctx.save();
            const shadowAlpha = (1 - scaleX) * 0.45;
            ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
            ctx.fillRect(drawX, 0, drawW, height);
            ctx.restore();
            break;
          }

          case 'circle-reveal': {
            const p = easeInOutCubic(rawTrans);
            const maxR = Math.hypot(width / 2, height / 2) * 1.05;
            ctx.drawImage(outCanvas, 0, 0);
            ctx.save();
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, maxR * p, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(inCanvas, 0, 0);
            ctx.restore();
            break;
          }

          case 'diamond-reveal': {
            const p = easeInOutCubic(rawTrans);
            const rx = width * 1.05 * p;
            const ry = height * 1.05 * p;
            ctx.drawImage(outCanvas, 0, 0);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(width / 2, height / 2 - ry);
            ctx.lineTo(width / 2 + rx, height / 2);
            ctx.lineTo(width / 2, height / 2 + ry);
            ctx.lineTo(width / 2 - rx, height / 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(inCanvas, 0, 0);
            ctx.restore();
            break;
          }

          case 'glitch-cut': {
            const base = rawTrans < 0.5 ? outCanvas : inCanvas;
            ctx.drawImage(base, 0, 0);
            const slices = 10;
            const sliceH = height / slices;
            const intensity = Math.sin(rawTrans * Math.PI);
            for (let s = 0; s < slices; s++) {
              const dir = s % 2 === 0 ? 1 : -1;
              const shift = dir * intensity * width * (0.04 + ((s * 3) % 5) * 0.015);
              const src = (s + Math.floor(rawTrans * 7)) % 2 === 0 ? inCanvas : outCanvas;
              ctx.drawImage(
                src,
                0,
                s * sliceH,
                width,
                sliceH,
                shift,
                s * sliceH,
                width,
                sliceH
              );
            }
            if (intensity > 0.4) {
              ctx.save();
              ctx.fillStyle = `rgba(56, 189, 248, ${(intensity - 0.4) * 0.25})`;
              ctx.fillRect(0, 0, width, height);
              ctx.restore();
            }
            break;
          }

          case 'zoom-through': {
            const p = easeInOutQuart(rawTrans);
            if (p < 0.62) {
              const outP = p / 0.62;
              const sc = 1 + outP * 0.35;
              const dw = width * sc;
              const dh = height * sc;
              ctx.save();
              ctx.globalAlpha = 1 - outP;
              ctx.drawImage(outCanvas, (width - dw) / 2, (height - dh) / 2, dw, dh);
              ctx.restore();
            }
            if (p > 0.22) {
              const inP = (p - 0.22) / 0.78;
              const sc = lerp(0.84, 1, inP);
              const dw = width * sc;
              const dh = height * sc;
              ctx.save();
              ctx.globalAlpha = smoothstep(inP);
              ctx.drawImage(inCanvas, (width - dw) / 2, (height - dh) / 2, dw, dh);
              ctx.restore();
            }
            break;
          }

          case 'flash-strobe': {
            const base = rawTrans < 0.4 ? outCanvas : inCanvas;
            ctx.drawImage(base, 0, 0);
            const flash =
              rawTrans < 0.4
                ? Math.pow(rawTrans / 0.4, 2) * 0.85
                : Math.pow(1 - (rawTrans - 0.4) / 0.6, 1.8) * 0.85;
            if (flash > 0.01) {
              ctx.save();
              ctx.fillStyle = `rgba(255, 250, 240, ${flash})`;
              ctx.fillRect(0, 0, width, height);
              ctx.restore();
            }
            break;
          }
        }
      }
    }
  }

  // Global overlays (particles, vignette, wedding inner border, cinema matte)
  drawGlobalOverlays(
    ctx,
    width,
    height,
    themeId,
    colorGrade,
    particleOverlay,
    t,
    aspectRatio
  );

  // Intro Title Card Overlay
  if (intro.enabled && plan.introEnd > 0 && t <= plan.introEnd) {
    const introDur = plan.introEnd - plan.introStart;
    const progress = clamp(t / Math.max(0.01, introDur), 0, 1);
    const fadeOutSpan = Math.min(0.45, introDur * 0.35);
    const fadeAlpha =
      t > plan.introEnd - fadeOutSpan
        ? clamp((plan.introEnd - t) / fadeOutSpan, 0, 1)
        : 1;
    drawTitleCard(ctx, width, height, intro, progress, fadeAlpha, theme.accentHex);
  }

  // Outro Card Overlay
  if (outro.enabled && plan.outroEnd > plan.outroStart && t >= plan.outroStart) {
    const outroDur = plan.outroEnd - plan.outroStart;
    const progress = clamp((t - plan.outroStart) / Math.max(0.01, outroDur), 0, 1);
    const fadeInSpan = Math.min(0.45, outroDur * 0.35);
    const fadeAlpha =
      t < plan.outroStart + fadeInSpan
        ? clamp((t - plan.outroStart) / fadeInSpan, 0, 1)
        : 1;
    drawTitleCard(ctx, width, height, outro, progress, fadeAlpha, theme.accentHex);
  }
}
