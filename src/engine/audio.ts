import { AudioTrackConfig } from '../types/studio';

export async function decodeAudioTrack(file: File): Promise<AudioTrackConfig> {
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
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const url = URL.createObjectURL(file);

    return {
      fileName: file.name,
      url,
      buffer: audioBuffer,
      durationSec: audioBuffer.duration,
      volume: 0.75,
      fadeInSec: 1.5,
      fadeOutSec: 2.0,
    };
  } finally {
    await ctx.close().catch(() => {});
  }
}

export function computeAudioGainAtTime(
  currentTimeSec: number,
  totalDurationSec: number,
  volume: number,
  fadeInSec: number,
  fadeOutSec: number
): number {
  let gain = volume;
  if (fadeInSec > 0.05 && currentTimeSec < fadeInSec) {
    gain *= Math.max(0, Math.min(1, currentTimeSec / fadeInSec));
  }
  const timeRemaining = totalDurationSec - currentTimeSec;
  if (fadeOutSec > 0.05 && timeRemaining < fadeOutSec) {
    gain *= Math.max(0, Math.min(1, timeRemaining / fadeOutSec));
  }
  return Math.max(0, Math.min(1, gain));
}
