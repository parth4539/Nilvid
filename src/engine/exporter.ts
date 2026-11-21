import {
  AspectRatioId,
  AudioClip,
  ColorGradeConfig,
  ExportResolution,
  ExportResult,
  ParticleOverlayId,
  RenderPlan,
  ThemeId,
  TitleCardConfig,
} from '../types/studio';
import { renderFrame, syncTimelineVideos } from './renderer';
import { getDimensionsForAspect } from './themes';

export interface ExportVideoOptions {
  plan: RenderPlan;
  themeId: ThemeId;
  aspectRatio: AspectRatioId;
  resolution: ExportResolution;
  colorGrade: ColorGradeConfig;
  particleOverlay: ParticleOverlayId;
  intro: TitleCardConfig;
  outro: TitleCardConfig;
  audioClips: AudioClip[];
  signal?: AbortSignal;
  onProgress: (progressPct: number, elapsedSec: number) => void;
  onPreviewFrame?: (canvas: HTMLCanvasElement, timeSec: number) => void;
}

function selectSupportedMimeType(hasAudio: boolean): {
  mimeType: string;
  extension: string;
} {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser.');
  }

  const candidates = hasAudio
    ? [
        { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
        { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
        { mimeType: 'video/webm', extension: 'webm' },
        { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
        { mimeType: 'video/mp4', extension: 'mp4' },
      ]
    : [
        { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
        { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
        { mimeType: 'video/webm', extension: 'webm' },
        { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
        { mimeType: 'video/mp4', extension: 'mp4' },
      ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { mimeType: 'video/webm', extension: 'webm' };
}

export async function exportSlideshowVideo(
  options: ExportVideoOptions
): Promise<ExportResult> {
  const {
    plan,
    themeId,
    aspectRatio,
    resolution,
    colorGrade,
    particleOverlay,
    intro,
    outro,
    audioClips,
    signal,
    onProgress,
    onPreviewFrame,
  } = options;

  if (plan.schedule.length === 0 && audioClips.length === 0) {
    throw new Error('Add at least one image or video clip before exporting.');
  }

  const durationSec = Math.max(0.5, plan.totalDuration);
  const { width, height } = getDimensionsForAspect(aspectRatio, resolution);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;

  const ctx = exportCanvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for export.');
  }

  if (typeof exportCanvas.captureStream !== 'function') {
    throw new Error('Canvas captureStream() is not supported in this browser.');
  }

  // Pre-seek all video clips to their trim start so initial playback is crisp
  for (const item of plan.schedule) {
    if (item.clip.kind === 'video' && item.clip.videoElement) {
      try {
        item.clip.videoElement.pause();
        item.clip.videoElement.currentTime = item.clip.sourceStartSec;
      } catch {
        // ignore
      }
    }
  }
  await new Promise((r) => window.setTimeout(r, 80));

  const fps = 30;
  const videoBitsPerSecond = resolution === '1080p' ? 8_000_000 : 4_500_000;

  syncTimelineVideos(plan, 0, true);
  renderFrame(
    ctx,
    width,
    height,
    plan,
    themeId,
    0,
    aspectRatio,
    colorGrade,
    particleOverlay,
    intro,
    outro
  );
  onPreviewFrame?.(exportCanvas, 0);

  const canvasStream = exportCanvas.captureStream(fps);
  let combinedStream: MediaStream = canvasStream;

  let audioCtx: AudioContext | null = null;
  const scheduledSources: AudioBufferSourceNode[] = [];

  const hasVideoAudio = plan.schedule.some(
    (item) =>
      item.clip.kind === 'video' &&
      !item.clip.muted &&
      item.clip.volume > 0 &&
      item.clip.audioBuffer
  );
  const shouldIncludeAudio = audioClips.length > 0 || hasVideoAudio;
  let hasAudio = false;

  if (shouldIncludeAudio) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const dest = audioCtx.createMediaStreamDestination();
      const baseTime = audioCtx.currentTime + 0.02;

      // Schedule Track A1 Song Clips
      for (const aClip of audioClips) {
        if (aClip.durationSec <= 0.05) continue;
        const source = audioCtx.createBufferSource();
        source.buffer = aClip.buffer;
        source.loop = true;

        const gainNode = audioCtx.createGain();
        const clipStart = baseTime + aClip.startTime;
        const clipEnd = clipStart + aClip.durationSec;
        const vol = Math.max(0.0001, aClip.volume);
        const fadeIn = Math.min(aClip.fadeInSec, aClip.durationSec * 0.45);
        const fadeOut = Math.min(aClip.fadeOutSec, aClip.durationSec * 0.45);

        gainNode.gain.setValueAtTime(0.0001, baseTime);
        if (fadeIn > 0.05) {
          gainNode.gain.setValueAtTime(0.0001, clipStart);
          gainNode.gain.linearRampToValueAtTime(vol, clipStart + fadeIn);
        } else {
          gainNode.gain.setValueAtTime(vol, clipStart);
        }

        if (fadeOut > 0.05) {
          const fadeOutStart = Math.max(clipStart + fadeIn, clipEnd - fadeOut);
          gainNode.gain.setValueAtTime(vol, fadeOutStart);
          gainNode.gain.linearRampToValueAtTime(0.0001, clipEnd);
        } else {
          gainNode.gain.setValueAtTime(0.0001, clipEnd);
        }

        source.connect(gainNode);
        gainNode.connect(dest);
        const srcOffset = aClip.sourceOffsetSec % Math.max(0.1, aClip.sourceDurationSec);
        source.start(clipStart, srcOffset, aClip.durationSec);
        scheduledSources.push(source);
      }

      // Schedule Unmuted Video Clip Audio
      for (const item of plan.schedule) {
        const clip = item.clip;
        if (
          clip.kind !== 'video' ||
          clip.muted ||
          clip.volume <= 0 ||
          !clip.audioBuffer
        ) {
          continue;
        }
        const clipDur = Math.max(0.05, item.endTime - item.startTime);
        const source = audioCtx.createBufferSource();
        source.buffer = clip.audioBuffer;
        source.playbackRate.value = Math.max(0.25, Math.min(4.0, clip.speed));

        const gainNode = audioCtx.createGain();
        const clipStart = baseTime + item.startTime;
        const clipEnd = baseTime + item.endTime;
        const vol = Math.max(0.0001, clip.volume);
        gainNode.gain.setValueAtTime(vol, clipStart);
        gainNode.gain.setValueAtTime(0.0001, clipEnd);

        source.connect(gainNode);
        gainNode.connect(dest);

        const sourceSpan = Math.min(
          Math.max(0.05, clip.sourceDurationSec - clip.sourceStartSec),
          clipDur * clip.speed
        );
        source.start(clipStart, clip.sourceStartSec, sourceSpan);
        scheduledSources.push(source);
      }

      combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      hasAudio = true;
    } catch {
      if (audioCtx) {
        await audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      hasAudio = false;
    }
  }

  const { mimeType, extension } = selectSupportedMimeType(hasAudio);
  const chunks: BlobPart[] = [];

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond,
    });
  } catch {
    recorder = new MediaRecorder(combinedStream);
  }

  return new Promise<ExportResult>((resolve, reject) => {
    let rafId = 0;
    let watchdogId = 0;
    let isFinished = false;
    let lastProgressUpdate = 0;

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (watchdogId) window.clearInterval(watchdogId);
      combinedStream.getTracks().forEach((track) => track.stop());
      syncTimelineVideos(plan, 0, false);
      for (const s of scheduledSources) {
        try {
          s.stop();
        } catch {
          // ignore
        }
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
    };

    const handleAbort = () => {
      if (isFinished) return;
      isFinished = true;
      cleanup();
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      reject(new DOMException('Export cancelled by user.', 'AbortError'));
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener('abort', handleAbort);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = () => {
      if (isFinished) return;
      isFinished = true;
      cleanup();
      reject(new Error('MediaRecorder encountered an encoding error.'));
    };

    recorder.onstop = () => {
      if (isFinished) return;
      isFinished = true;
      cleanup();

      const finalMime = recorder.mimeType || mimeType;
      const blob = new Blob(chunks, { type: finalMime });
      const blobUrl = URL.createObjectURL(blob);
      const roundedDur = Math.round(durationSec);
      const filename = `nilvid-${themeId}-${roundedDur}s.${extension}`;

      onProgress(100, durationSec);

      resolve({
        blobUrl,
        filename,
        mimeType: finalMime,
        sizeBytes: blob.size,
        durationSec,
        width,
        height,
        hasAudio,
      });
    };

    recorder.start(250);
    const startPerfMs = performance.now();

    const tick = () => {
      if (isFinished || signal?.aborted) return;

      const elapsedSec = (performance.now() - startPerfMs) / 1000;
      const clampedTime = Math.min(elapsedSec, durationSec);

      syncTimelineVideos(plan, clampedTime, true);
      renderFrame(
        ctx,
        width,
        height,
        plan,
        themeId,
        clampedTime,
        aspectRatio,
        colorGrade,
        particleOverlay,
        intro,
        outro
      );
      onPreviewFrame?.(exportCanvas, clampedTime);

      const now = performance.now();
      if (now - lastProgressUpdate > 65 || elapsedSec >= durationSec) {
        lastProgressUpdate = now;
        const pct = Math.min(99, (clampedTime / durationSec) * 100);
        onProgress(pct, clampedTime);
      }

      if (elapsedSec >= durationSec) {
        window.setTimeout(() => {
          if (!isFinished && recorder.state !== 'inactive') {
            recorder.stop();
          }
        }, 160);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    watchdogId = window.setInterval(() => {
      if (isFinished || signal?.aborted) return;
      const elapsedSec = (performance.now() - startPerfMs) / 1000;
      if (elapsedSec >= durationSec + 0.35 && recorder.state !== 'inactive') {
        renderFrame(
          ctx,
          width,
          height,
          plan,
          themeId,
          durationSec,
          aspectRatio,
          colorGrade,
          particleOverlay,
          intro,
          outro
        );
        recorder.stop();
      }
    }, 250);
  });
}

export function triggerFileDownload(blobUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatTimecode(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}
