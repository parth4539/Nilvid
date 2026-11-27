import {
  AudioBufferSource,
  AudioCodec,
  BufferTarget,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  VideoCodec,
  WebMOutputFormat,
} from 'mediabunny';
import {
  AspectRatioId,
  AudioClip,
  ColorGradeConfig,
  ExportFormat,
  ExportResolution,
  ExportResult,
  ParticleOverlayId,
  RenderPlan,
  ThemeId,
  TimelineTrack,
  TitleCardConfig,
} from '../types/studio';
import {
  renderFrame,
  seekTimelineVideosExact,
  syncTimelineVideos,
} from './renderer';
import { getDimensionsForAspect } from './themes';

export interface ExportVideoOptions {
  plan: RenderPlan;
  themeId: ThemeId;
  aspectRatio: AspectRatioId;
  resolution: ExportResolution;
  format: ExportFormat;
  colorGrade: ColorGradeConfig;
  particleOverlay: ParticleOverlayId;
  intro: TitleCardConfig;
  outro: TitleCardConfig;
  audioClips: AudioClip[];
  tracks?: TimelineTrack[];
  signal?: AbortSignal;
  onProgress: (progressPct: number, elapsedSec: number) => void;
  onPreviewFrame?: (canvas: HTMLCanvasElement, timeSec: number) => void;
}

async function renderOfflineAudioMix(
  plan: RenderPlan,
  audioClips: AudioClip[],
  durationSec: number,
  mutedTrackIds: Set<string>
): Promise<AudioBuffer | null> {
  const allScheduleItems = Object.values(plan.trackSchedules).flat();
  const activeAudioClips = audioClips.filter(
    (ac) => !mutedTrackIds.has(ac.trackId || 'a1')
  );
  const hasVideoAudio = allScheduleItems.some(
    (item) =>
      !mutedTrackIds.has(item.clip.trackId || 'v1') &&
      item.clip.kind === 'video' &&
      !item.clip.muted &&
      item.clip.volume > 0 &&
      item.clip.audioBuffer
  );
  if (activeAudioClips.length === 0 && !hasVideoAudio) {
    return null;
  }

  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!OfflineCtx) {
    return null;
  }

  const sampleRate = 48000;
  const totalSamples = Math.max(1, Math.ceil(durationSec * sampleRate));
  const offlineCtx = new OfflineCtx(2, totalSamples, sampleRate);

  // Schedule Song Clips across all unmuted Audio Tracks (A1, A2, ...)
  for (const aClip of activeAudioClips) {
    if (aClip.durationSec <= 0.05 || aClip.startTime >= durationSec) continue;
    const source = offlineCtx.createBufferSource();
    source.buffer = aClip.buffer;
    source.loop = true;

    const gainNode = offlineCtx.createGain();
    const clipStart = Math.max(0, aClip.startTime);
    const clipEnd = Math.min(durationSec, aClip.startTime + aClip.durationSec);
    const activeDur = Math.max(0.05, clipEnd - clipStart);
    const vol = Math.max(0.0001, aClip.volume);
    const fadeIn = Math.min(aClip.fadeInSec, activeDur * 0.45);
    const fadeOut = Math.min(aClip.fadeOutSec, activeDur * 0.45);

    gainNode.gain.setValueAtTime(0.0001, 0);
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
    gainNode.connect(offlineCtx.destination);
    const srcOffset =
      aClip.sourceOffsetSec % Math.max(0.1, aClip.sourceDurationSec);
    source.start(clipStart, srcOffset, activeDur);
  }

  // Schedule Unmuted Video Clip Audio across all Video Tracks (V1, V2, ...)
  for (const item of allScheduleItems) {
    const clip = item.clip;
    if (
      mutedTrackIds.has(clip.trackId || 'v1') ||
      clip.kind !== 'video' ||
      clip.muted ||
      clip.volume <= 0 ||
      !clip.audioBuffer ||
      item.startTime >= durationSec
    ) {
      continue;
    }

    const clipDur = Math.max(
      0.05,
      Math.min(durationSec, item.endTime) - Math.max(0, item.startTime)
    );
    const rate = Math.max(0.25, Math.min(4.0, clip.speed));
    const source = offlineCtx.createBufferSource();
    source.buffer = clip.audioBuffer;
    source.playbackRate.value = rate;

    const gainNode = offlineCtx.createGain();
    const clipStart = Math.max(0, item.startTime);
    const clipEnd = Math.min(durationSec, item.endTime);
    const vol = Math.max(0.0001, clip.volume);
    gainNode.gain.setValueAtTime(vol, clipStart);
    gainNode.gain.setValueAtTime(0.0001, clipEnd);

    source.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    const sourceSpan = Math.min(
      Math.max(0.05, clip.sourceDurationSec - clip.sourceStartSec),
      clipDur * rate
    );
    if (sourceSpan > 0.05 && clip.sourceStartSec < clip.sourceDurationSec) {
      source.start(clipStart, clip.sourceStartSec, sourceSpan);
    }
  }

  return offlineCtx.startRendering();
}

async function exportWithMediabunny(
  options: ExportVideoOptions,
  exportCanvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  durationSec: number
): Promise<ExportResult> {
  const {
    plan,
    themeId,
    aspectRatio,
    resolution,
    format,
    colorGrade,
    particleOverlay,
    intro,
    outro,
    audioClips,
    tracks,
    signal,
    onProgress,
    onPreviewFrame,
  } = options;
  const mutedTrackIds = new Set(
    (tracks ?? []).filter((t) => t.muted).map((t) => t.id)
  );

  const fps = 30;
  const videoBitsPerSecond = resolution === '1080p' ? 8_000_000 : 4_500_000;

  const outputFormat =
    format === 'mov'
      ? new MovOutputFormat({ fastStart: 'in-memory' })
      : format === 'mp4'
      ? new Mp4OutputFormat({ fastStart: 'in-memory' })
      : new WebMOutputFormat();

  const preferredVideoCodecs: VideoCodec[] =
    format === 'webm'
      ? ['vp9', 'vp8', 'av1']
      : ['avc', 'hevc', 'vp9', 'av1'];

  const supportedVideoCodecs = outputFormat
    .getSupportedVideoCodecs()
    .filter((c) => preferredVideoCodecs.includes(c));
  const orderedVideoCodecs = preferredVideoCodecs.filter((c) =>
    supportedVideoCodecs.includes(c)
  );

  const chosenVideoCodec = await getFirstEncodableVideoCodec(orderedVideoCodecs, {
    width,
    height,
    bitrate: videoBitsPerSecond,
    frameRate: fps,
  });

  if (!chosenVideoCodec) {
    throw new Error(
      `This browser does not support WebCodecs video encoding for ${format.toUpperCase()}.`
    );
  }

  const target = new BufferTarget();
  const output = new Output({
    format: outputFormat,
    target,
  });

  const videoSource = new CanvasSource(exportCanvas, {
    codec: chosenVideoCodec,
    bitrate: videoBitsPerSecond,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  // Offline mix audio if present
  const mixedAudioBuffer = await renderOfflineAudioMix(
    plan,
    audioClips,
    durationSec,
    mutedTrackIds
  );
  let audioSource: AudioBufferSource | null = null;
  let hasAudio = false;

  if (mixedAudioBuffer) {
    const preferredAudioCodecs: AudioCodec[] =
      format === 'webm'
        ? ['opus', 'vorbis']
        : ['aac', 'opus', 'mp3', 'pcm-s16'];

    const supportedAudioCodecs = outputFormat.getSupportedAudioCodecs();
    const orderedAudioCodecs = preferredAudioCodecs.filter((c) =>
      supportedAudioCodecs.includes(c)
    );

    const chosenAudioCodec = await getFirstEncodableAudioCodec(
      orderedAudioCodecs,
      {
        numberOfChannels: mixedAudioBuffer.numberOfChannels,
        sampleRate: mixedAudioBuffer.sampleRate,
        quality: QUALITY_HIGH,
      }
    );

    if (chosenAudioCodec) {
      audioSource = new AudioBufferSource(
        chosenAudioCodec.startsWith('pcm-')
          ? { codec: chosenAudioCodec }
          : { codec: chosenAudioCodec, quality: QUALITY_HIGH }
      );
      output.addAudioTrack(audioSource);
      hasAudio = true;
    }
  }

  if (signal?.aborted) {
    throw new DOMException('Export cancelled by user.', 'AbortError');
  }

  const handleAbort = () => {
    output.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', handleAbort, { once: true });

  try {
    await output.start();

    if (audioSource && mixedAudioBuffer) {
      await audioSource.add(mixedAudioBuffer);
      audioSource.close();
    }

    const totalFrames = Math.max(1, Math.ceil(durationSec * fps));
    const frameDuration = 1 / fps;
    const allScheduleItems = Object.values(plan.trackSchedules).flat();
    const hasVideoClips = allScheduleItems.some((s) => s.clip.kind === 'video');
    let lastUiUpdateMs = 0;

    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      if (signal?.aborted) {
        await output.cancel().catch(() => {});
        throw new DOMException('Export cancelled by user.', 'AbortError');
      }

      const timestampSec = frameIdx * frameDuration;
      const clampedT = Math.min(durationSec, timestampSec);

      if (hasVideoClips) {
        await seekTimelineVideosExact(plan, clampedT);
      }

      renderFrame(
        ctx,
        width,
        height,
        plan,
        themeId,
        clampedT,
        aspectRatio,
        colorGrade,
        particleOverlay,
        intro,
        outro,
        tracks
      );

      await videoSource.add(timestampSec, frameDuration);

      const now = performance.now();
      if (now - lastUiUpdateMs > 60 || frameIdx === totalFrames - 1) {
        lastUiUpdateMs = now;
        onPreviewFrame?.(exportCanvas, clampedT);
        const pct = Math.min(98, ((frameIdx + 1) / totalFrames) * 98);
        onProgress(pct, clampedT);
        // Yield to UI thread so progress bar & Cancel button stay responsive
        await new Promise((r) => window.setTimeout(r, 0));
      }
    }

    videoSource.close();
    await output.finalize();

    if (signal?.aborted) {
      throw new DOMException('Export cancelled by user.', 'AbortError');
    }

    const rawBuffer = target.buffer;
    if (!rawBuffer) {
      throw new Error('Muxer finished without generating an output buffer.');
    }

    const mimeType = outputFormat.mimeType;
    const blob = new Blob([rawBuffer], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    const roundedDur = Math.round(durationSec);
    const filename = `nilvid-${themeId}-${roundedDur}s.${format}`;

    onProgress(100, durationSec);

    return {
      blobUrl,
      filename,
      format,
      mimeType,
      sizeBytes: blob.size,
      durationSec,
      width,
      height,
      hasAudio,
    };
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    signal?.removeEventListener('abort', handleAbort);
    syncTimelineVideos(plan, 0, false);
  }
}

function selectMediaRecorderMimeType(
  format: ExportFormat,
  hasAudio: boolean
): {
  mimeType: string;
  extension: ExportFormat;
} {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser.');
  }

  const mp4Candidates = hasAudio
    ? [
        { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' as const },
        { mimeType: 'video/mp4', extension: 'mp4' as const },
      ]
    : [
        { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' as const },
        { mimeType: 'video/mp4', extension: 'mp4' as const },
      ];

  const webmCandidates = hasAudio
    ? [
        { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' as const },
        { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' as const },
        { mimeType: 'video/webm', extension: 'webm' as const },
      ]
    : [
        { mimeType: 'video/webm;codecs=vp9', extension: 'webm' as const },
        { mimeType: 'video/webm;codecs=vp8', extension: 'webm' as const },
        { mimeType: 'video/webm', extension: 'webm' as const },
      ];

  const ordered =
    format === 'mp4'
      ? [...mp4Candidates, ...webmCandidates]
      : [...webmCandidates, ...mp4Candidates];

  for (const candidate of ordered) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { mimeType: 'video/webm', extension: 'webm' };
}

async function exportWithMediaRecorder(
  options: ExportVideoOptions,
  exportCanvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  durationSec: number
): Promise<ExportResult> {
  const {
    plan,
    themeId,
    aspectRatio,
    resolution,
    format,
    colorGrade,
    particleOverlay,
    intro,
    outro,
    audioClips,
    tracks,
    signal,
    onProgress,
    onPreviewFrame,
  } = options;
  const mutedTrackIds = new Set(
    (tracks ?? []).filter((t) => t.muted).map((t) => t.id)
  );
  const allScheduleItems = Object.values(plan.trackSchedules).flat();
  const activeAudioClips = audioClips.filter(
    (ac) => !mutedTrackIds.has(ac.trackId || 'a1')
  );

  // Pre-seek all video clips to their trim start so initial playback is crisp
  for (const item of allScheduleItems) {
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
    outro,
    tracks
  );
  onPreviewFrame?.(exportCanvas, 0);

  const canvasStream = exportCanvas.captureStream(fps);
  let combinedStream: MediaStream = canvasStream;

  let audioCtx: AudioContext | null = null;
  const scheduledSources: AudioBufferSourceNode[] = [];

  const hasVideoAudio = allScheduleItems.some(
    (item) =>
      !mutedTrackIds.has(item.clip.trackId || 'v1') &&
      item.clip.kind === 'video' &&
      !item.clip.muted &&
      item.clip.volume > 0 &&
      item.clip.audioBuffer
  );
  const shouldIncludeAudio = activeAudioClips.length > 0 || hasVideoAudio;
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

      for (const aClip of activeAudioClips) {
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
        const srcOffset =
          aClip.sourceOffsetSec % Math.max(0.1, aClip.sourceDurationSec);
        source.start(clipStart, srcOffset, aClip.durationSec);
        scheduledSources.push(source);
      }

      for (const item of allScheduleItems) {
        const clip = item.clip;
        if (
          mutedTrackIds.has(clip.trackId || 'v1') ||
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

  const { mimeType, extension } = selectMediaRecorderMimeType(format, hasAudio);
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
        format: extension,
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
        outro,
        tracks
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
          outro,
          tracks
        );
        recorder.stop();
      }
    }, 250);
  });
}

export async function exportSlideshowVideo(
  options: ExportVideoOptions
): Promise<ExportResult> {
  const { plan, aspectRatio, resolution, format, audioClips } = options;

  const hasVisualClips = Object.values(plan.trackSchedules).some(
    (list) => list.length > 0
  );
  if (!hasVisualClips && audioClips.length === 0) {
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

  // Prefer WebCodecs + Mediabunny for crisp MP4 / MOV / WebM container export
  if (typeof VideoEncoder !== 'undefined') {
    try {
      return await exportWithMediabunny(
        options,
        exportCanvas,
        ctx,
        width,
        height,
        durationSec
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      // If MOV explicitly requested and WebCodecs failed, surface clear reason
      if (format === 'mov') {
        throw err;
      }
      // Otherwise fall back to MediaRecorder for MP4/WebM
    }
  } else if (format === 'mov') {
    throw new Error(
      'QuickTime (.mov) export requires WebCodecs support (available in Chrome, Edge, Safari 16.4+, and Firefox 130+). Try MP4 or WebM in this browser.'
    );
  }

  if (typeof exportCanvas.captureStream !== 'function') {
    throw new Error('Canvas captureStream() is not supported in this browser.');
  }

  return exportWithMediaRecorder(
    options,
    exportCanvas,
    ctx,
    width,
    height,
    durationSec
  );
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
