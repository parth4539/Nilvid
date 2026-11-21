import { AudioClip, MediaAsset, TimelineClip } from '../types/studio';
import { decodeAudioBufferFromFile, extractWaveformPeaks } from './audio';

export interface SampleAssetSpec {
  id: string;
  name: string;
  url: string;
}

export const SAMPLE_ASSETS: SampleAssetSpec[] = [
  {
    id: 'sample-coastal',
    name: 'coastal-cliffs.jpg',
    url: '/src/assets/images/sample_coastal_cliff_1795253374819.jpg',
  },
  {
    id: 'sample-alpine',
    name: 'alpine-sunrise.jpg',
    url: '/src/assets/images/sample_alpine_lake_1795253375173.jpg',
  },
  {
    id: 'sample-garden',
    name: 'twilight-garden.jpg',
    url: '/src/assets/images/sample_garden_celebration_1795253375031.jpg',
  },
  {
    id: 'sample-rooftop',
    name: 'rooftop-dusk.jpg',
    url: '/src/assets/images/sample_city_nightlife_1795253375184.jpg',
  },
];

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export function createVideoElement(url: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  return video;
}

function probeVideoMetadata(url: string): Promise<{
  width: number;
  height: number;
  durationSec: number;
  thumbnailUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Timed out loading video metadata.'));
      }
    }, 10000);

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);

      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const durationSec =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : 5;

      let thumbnailUrl = '';
      try {
        const thumbCanvas = document.createElement('canvas');
        const targetW = 320;
        const targetH = Math.max(180, Math.round((targetW * height) / width));
        thumbCanvas.width = targetW;
        thumbCanvas.height = targetH;
        const tctx = thumbCanvas.getContext('2d');
        if (tctx) {
          tctx.drawImage(video, 0, 0, targetW, targetH);
          thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.78);
        }
      } catch {
        thumbnailUrl = '';
      }

      video.removeAttribute('src');
      video.load();
      resolve({ width, height, durationSec, thumbnailUrl });
    };

    video.onloadeddata = () => {
      const targetSeek = Math.min(0.15, Math.max(0, (video.duration || 1) * 0.1));
      if (targetSeek > 0.01) {
        video.onseeked = finish;
        video.currentTime = targetSeek;
      } else {
        finish();
      }
    };

    video.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      reject(new Error('Could not decode video file.'));
    };
  });
}

export async function loadSampleAssets(): Promise<MediaAsset[]> {
  return Promise.all(
    SAMPLE_ASSETS.map(async (item) => {
      const element = await loadImageElement(item.url);
      return {
        id: `${item.id}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'image',
        name: item.name,
        url: item.url,
        thumbnailUrl: item.url,
        width: element.naturalWidth || 1600,
        height: element.naturalHeight || 900,
        durationSec: 5,
        imageElement: element,
        isSample: true,
      } satisfies MediaAsset;
    })
  );
}

export async function filesToMediaAssets(
  files: FileList | File[]
): Promise<MediaAsset[]> {
  const fileList = Array.from(files);
  const assets: MediaAsset[] = [];

  for (const file of fileList) {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      try {
        const element = await loadImageElement(url);
        assets.push({
          id: `asset-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: 'image',
          name: file.name,
          url,
          thumbnailUrl: url,
          width: element.naturalWidth || 1280,
          height: element.naturalHeight || 720,
          durationSec: 5,
          imageElement: element,
          isSample: false,
        });
      } catch {
        URL.revokeObjectURL(url);
      }
    } else if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      try {
        const meta = await probeVideoMetadata(url);
        let audioBuffer: AudioBuffer | null = null;
        try {
          audioBuffer = await decodeAudioBufferFromFile(file);
        } catch {
          audioBuffer = null; // Video may have no audio track or unsupported audio codec
        }
        assets.push({
          id: `asset-vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: 'video',
          name: file.name,
          url,
          thumbnailUrl: meta.thumbnailUrl,
          width: meta.width,
          height: meta.height,
          durationSec: meta.durationSec,
          audioBuffer,
          isSample: false,
        });
      } catch {
        URL.revokeObjectURL(url);
      }
    } else if (file.type.startsWith('audio/')) {
      const url = URL.createObjectURL(file);
      try {
        const buffer = await decodeAudioBufferFromFile(file);
        assets.push({
          id: `asset-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: 'audio',
          name: file.name,
          url,
          thumbnailUrl: '',
          width: 0,
          height: 0,
          durationSec: buffer.duration,
          audioBuffer: buffer,
          waveformPeaks: extractWaveformPeaks(buffer, 64),
          isSample: false,
        });
      } catch {
        URL.revokeObjectURL(url);
      }
    }
  }

  return assets;
}

export function createTimelineClipFromAsset(asset: MediaAsset): TimelineClip {
  if (asset.kind === 'video') {
    const videoEl = createVideoElement(asset.url);
    return {
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      assetId: asset.id,
      kind: 'video',
      name: asset.name,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      width: asset.width,
      height: asset.height,
      videoElement: videoEl,
      audioBuffer: asset.audioBuffer ?? null,
      sourceDurationSec: asset.durationSec,
      sourceStartSec: 0,
      durationSec: Math.min(10, Math.max(1, Number(asset.durationSec.toFixed(2)))),
      speed: 1,
      motionSpeed: 1,
      volume: 0.85,
      muted: false,
    };
  }

  return {
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    assetId: asset.id,
    kind: 'image',
    name: asset.name,
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl,
    width: asset.width,
    height: asset.height,
    imageElement: asset.imageElement,
    sourceDurationSec: 5,
    sourceStartSec: 0,
    durationSec: 5,
    speed: 1,
    motionSpeed: 1,
    volume: 1,
    muted: true,
  };
}

export function cloneTimelineClip(clip: TimelineClip): TimelineClip {
  return {
    ...clip,
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    videoElement: clip.kind === 'video' ? createVideoElement(clip.url) : undefined,
  };
}

export function createAudioClipFromAsset(
  asset: MediaAsset,
  startTime: number
): AudioClip | null {
  if (asset.kind !== 'audio' || !asset.audioBuffer) return null;
  return {
    id: `audioclip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    assetId: asset.id,
    name: asset.name,
    buffer: asset.audioBuffer,
    waveformPeaks: asset.waveformPeaks ?? extractWaveformPeaks(asset.audioBuffer, 64),
    sourceDurationSec: asset.durationSec,
    startTime: Math.max(0, Number(startTime.toFixed(2))),
    durationSec: Math.min(15, Math.max(1, Number(asset.durationSec.toFixed(2)))),
    sourceOffsetSec: 0,
    volume: 0.75,
    fadeInSec: 1.0,
    fadeOutSec: 1.5,
  };
}
