import { AudioClip } from '../types/studio';

export function extractWaveformPeaks(
  buffer: AudioBuffer,
  buckets = 64
): number[] {
  const channel = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / buckets));
  const peaks: number[] = [];

  for (let i = 0; i < buckets; i++) {
    const start = i * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    let maxVal = 0;
    const step = Math.max(1, Math.floor((end - start) / 40));
    for (let j = start; j < end; j += step) {
      const abs = Math.abs(channel[j]);
      if (abs > maxVal) maxVal = abs;
    }
    peaks.push(Math.min(1, Math.max(0.08, maxVal)));
  }
  return peaks;
}

export async function decodeAudioBufferFromFile(
  file: File
): Promise<AudioBuffer> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await file.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    await ctx.close().catch(() => {});
  }
}

export function computeAudioClipGain(
  clip: AudioClip,
  timelineTimeSec: number
): number {
  const localT = timelineTimeSec - clip.startTime;
  if (localT < 0 || localT > clip.durationSec) return 0;

  let gain = clip.volume;
  const fadeIn = Math.min(clip.fadeInSec, clip.durationSec * 0.48);
  const fadeOut = Math.min(clip.fadeOutSec, clip.durationSec * 0.48);

  if (fadeIn > 0.05 && localT < fadeIn) {
    gain *= Math.max(0, Math.min(1, localT / fadeIn));
  }
  const remaining = clip.durationSec - localT;
  if (fadeOut > 0.05 && remaining < fadeOut) {
    gain *= Math.max(0, Math.min(1, remaining / fadeOut));
  }
  return Math.max(0, Math.min(1, gain));
}
