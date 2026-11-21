import {
  AspectRatioId,
  AudioClip,
  ColorGradeConfig,
  ExportFormat,
  ExportResolution,
  InspectorTab,
  MediaAsset,
  MediaKind,
  ParticleOverlayId,
  SelectionTarget,
  ThemeId,
  TimelineClip,
  TitleCardConfig,
} from '../types/studio';
import { decodeAudioBufferFromFile, extractWaveformPeaks } from './audio';
import { createVideoElement, loadImageElement } from './samples';

const DB_NAME = 'nilvid-studio-db';
const DB_VERSION = 1;
const STORE_MEDIA = 'mediaBlobs';
const STORE_PROJECT = 'projectState';
const PROJECT_KEY = 'current';

interface StoredMediaRecord {
  id: string;
  kind: MediaKind;
  name: string;
  width: number;
  height: number;
  durationSec: number;
  thumbnailUrl: string;
  waveformPeaks?: number[];
  isSample?: boolean;
  sampleUrl?: string;
  blob?: Blob;
}

type PersistedTimelineClip = Omit<
  TimelineClip,
  'url' | 'thumbnailUrl' | 'imageElement' | 'videoElement' | 'audioBuffer'
>;

type PersistedAudioClip = Omit<AudioClip, 'buffer'>;

export interface PersistedProjectPayload {
  version: 1;
  savedAt: number;
  binAssetIds: string[];
  clips: PersistedTimelineClip[];
  audioClips: PersistedAudioClip[];
  selection: SelectionTarget;
  activeTab: InspectorTab;
  themeId: ThemeId;
  aspectRatio: AspectRatioId;
  resolution: ExportResolution;
  exportFormat: ExportFormat;
  colorGrade: ColorGradeConfig;
  particleOverlay: ParticleOverlayId;
  intro: TitleCardConfig;
  outro: TitleCardConfig;
  currentTimeSec: number;
}

export interface HydratedProjectResult {
  assets: MediaAsset[];
  clips: TimelineClip[];
  audioClips: AudioClip[];
  selection: SelectionTarget;
  activeTab: InspectorTab;
  themeId: ThemeId;
  aspectRatio: AspectRatioId;
  resolution: ExportResolution;
  exportFormat: ExportFormat;
  colorGrade: ColorGradeConfig;
  particleOverlay: ParticleOverlayId;
  intro: TitleCardConfig;
  outro: TitleCardConfig;
  currentTimeSec: number;
  createdBlobUrls: string[];
}

function openStudioDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PROJECT)) {
          db.createObjectStore(STORE_PROJECT);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function serializeClip(clip: TimelineClip): PersistedTimelineClip {
  const {
    url: _url,
    thumbnailUrl: _thumb,
    imageElement: _img,
    videoElement: _vid,
    audioBuffer: _aud,
    ...rest
  } = clip;
  return rest;
}

function serializeAudioClip(clip: AudioClip): PersistedAudioClip {
  const { buffer: _buf, ...rest } = clip;
  return rest;
}

export interface SaveProjectInput {
  assets: MediaAsset[];
  clips: TimelineClip[];
  audioClips: AudioClip[];
  selection: SelectionTarget;
  activeTab: InspectorTab;
  themeId: ThemeId;
  aspectRatio: AspectRatioId;
  resolution: ExportResolution;
  exportFormat: ExportFormat;
  colorGrade: ColorGradeConfig;
  particleOverlay: ParticleOverlayId;
  intro: TitleCardConfig;
  outro: TitleCardConfig;
  currentTimeSec: number;
}

export async function savePersistedProject(
  input: SaveProjectInput
): Promise<void> {
  const db = await openStudioDb();
  if (!db) return;

  try {
    const referencedIds = new Set<string>([
      ...input.assets.map((a) => a.id),
      ...input.clips.map((c) => c.assetId),
      ...input.audioClips.map((a) => a.assetId),
    ]);

    // First sync mediaBlobs without rewriting already-stored binary blobs
    const mediaTx = db.transaction(STORE_MEDIA, 'readwrite');
    const mediaStore = mediaTx.objectStore(STORE_MEDIA);
    const existingKeysRaw = await idbRequest(mediaStore.getAllKeys());
    const existingKeys = new Set(existingKeysRaw.map((k) => String(k)));

    for (const asset of input.assets) {
      if (existingKeys.has(asset.id)) continue;
      if (!asset.isSample && !asset.sourceBlob) continue;

      const record: StoredMediaRecord = {
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        width: asset.width,
        height: asset.height,
        durationSec: asset.durationSec,
        thumbnailUrl: asset.isSample
          ? asset.url
          : asset.kind === 'video'
          ? asset.thumbnailUrl
          : '',
        waveformPeaks: asset.waveformPeaks,
        isSample: asset.isSample,
        sampleUrl: asset.isSample ? asset.url : undefined,
        blob: asset.isSample ? undefined : asset.sourceBlob,
      };
      mediaStore.put(record);
    }

    for (const key of existingKeys) {
      if (!referencedIds.has(key)) {
        mediaStore.delete(key);
      }
    }

    await new Promise<void>((resolve, reject) => {
      mediaTx.oncomplete = () => resolve();
      mediaTx.onerror = () => reject(mediaTx.error);
      mediaTx.onabort = () => reject(mediaTx.error);
    });

    const payload: PersistedProjectPayload = {
      version: 1,
      savedAt: Date.now(),
      binAssetIds: input.assets.map((a) => a.id),
      clips: input.clips.map(serializeClip),
      audioClips: input.audioClips.map(serializeAudioClip),
      selection: input.selection,
      activeTab: input.activeTab,
      themeId: input.themeId,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      exportFormat: input.exportFormat,
      colorGrade: input.colorGrade,
      particleOverlay: input.particleOverlay,
      intro: input.intro,
      outro: input.outro,
      currentTimeSec: input.currentTimeSec,
    };

    const projectTx = db.transaction(STORE_PROJECT, 'readwrite');
    projectTx.objectStore(STORE_PROJECT).put(payload, PROJECT_KEY);
    await new Promise<void>((resolve, reject) => {
      projectTx.oncomplete = () => resolve();
      projectTx.onerror = () => reject(projectTx.error);
    });
  } catch {
    // Ignore storage quota or private-mode IDB errors cleanly
  } finally {
    db.close();
  }
}

async function hydrateMediaRecord(
  record: StoredMediaRecord,
  createdBlobUrls: string[],
  sharedAudioCtx?: AudioContext
): Promise<MediaAsset | null> {
  if (record.isSample && record.sampleUrl) {
    try {
      const element = await loadImageElement(record.sampleUrl);
      return {
        id: record.id,
        kind: 'image',
        name: record.name,
        url: record.sampleUrl,
        thumbnailUrl: record.sampleUrl,
        width: element.naturalWidth || record.width || 1600,
        height: element.naturalHeight || record.height || 900,
        durationSec: 5,
        imageElement: element,
        isSample: true,
      };
    } catch {
      return null;
    }
  }

  if (!record.blob) return null;

  const url = URL.createObjectURL(record.blob);
  createdBlobUrls.push(url);

  try {
    if (record.kind === 'image') {
      const element = await loadImageElement(url);
      return {
        id: record.id,
        kind: 'image',
        name: record.name,
        url,
        thumbnailUrl: url,
        width: element.naturalWidth || record.width || 1280,
        height: element.naturalHeight || record.height || 720,
        durationSec: 5,
        imageElement: element,
        sourceBlob: record.blob,
        isSample: false,
      };
    }

    if (record.kind === 'video') {
      let audioBuffer: AudioBuffer | null = null;
      try {
        audioBuffer = await decodeAudioBufferFromFile(
          record.blob,
          sharedAudioCtx
        );
      } catch {
        audioBuffer = null;
      }
      return {
        id: record.id,
        kind: 'video',
        name: record.name,
        url,
        thumbnailUrl: record.thumbnailUrl,
        width: record.width || 1280,
        height: record.height || 720,
        durationSec: record.durationSec || 5,
        audioBuffer,
        sourceBlob: record.blob,
        isSample: false,
      };
    }

    const audioBuffer = await decodeAudioBufferFromFile(
      record.blob,
      sharedAudioCtx
    );
    return {
      id: record.id,
      kind: 'audio',
      name: record.name,
      url,
      thumbnailUrl: '',
      width: 0,
      height: 0,
      durationSec: audioBuffer.duration || record.durationSec,
      audioBuffer,
      waveformPeaks:
        record.waveformPeaks ?? extractWaveformPeaks(audioBuffer, 64),
      sourceBlob: record.blob,
      isSample: false,
    };
  } catch {
    return null;
  }
}

export async function loadPersistedProject(): Promise<HydratedProjectResult | null> {
  const db = await openStudioDb();
  if (!db) return null;

  const createdBlobUrls: string[] = [];

  try {
    const projectTx = db.transaction(STORE_PROJECT, 'readonly');
    const payload = (await idbRequest(
      projectTx.objectStore(STORE_PROJECT).get(PROJECT_KEY)
    )) as PersistedProjectPayload | undefined;

    if (!payload || payload.version !== 1) {
      return null;
    }

    const neededIds = new Set<string>([
      ...payload.binAssetIds,
      ...payload.clips.map((c) => c.assetId),
      ...payload.audioClips.map((a) => a.assetId),
    ]);

    const mediaTx = db.transaction(STORE_MEDIA, 'readonly');
    const mediaStore = mediaTx.objectStore(STORE_MEDIA);
    const records = await Promise.all(
      Array.from(neededIds).map(
        (id) =>
          idbRequest(mediaStore.get(id)) as Promise<
            StoredMediaRecord | undefined
          >
      )
    );

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    const sharedAudioCtx = AudioCtx ? new AudioCtx() : undefined;

    const hydratedMap = new Map<string, MediaAsset>();
    try {
      await Promise.all(
        records.map(async (rec) => {
          if (!rec) return;
          const asset = await hydrateMediaRecord(
            rec,
            createdBlobUrls,
            sharedAudioCtx
          );
          if (asset) {
            hydratedMap.set(asset.id, asset);
          }
        })
      );
    } finally {
      if (sharedAudioCtx) {
        await sharedAudioCtx.close().catch(() => {});
      }
    }

    const assets: MediaAsset[] = [];
    for (const id of payload.binAssetIds) {
      const a = hydratedMap.get(id);
      if (a) assets.push(a);
    }

    const clips: TimelineClip[] = [];
    for (const pClip of payload.clips) {
      const asset = hydratedMap.get(pClip.assetId);
      if (!asset) continue;
      if (pClip.kind === 'video') {
        clips.push({
          ...pClip,
          url: asset.url,
          thumbnailUrl: asset.thumbnailUrl,
          videoElement: createVideoElement(asset.url),
          audioBuffer: asset.audioBuffer ?? null,
        });
      } else if (asset.imageElement) {
        clips.push({
          ...pClip,
          url: asset.url,
          thumbnailUrl: asset.thumbnailUrl,
          imageElement: asset.imageElement,
        });
      }
    }

    const audioClips: AudioClip[] = [];
    for (const pAudio of payload.audioClips) {
      const asset = hydratedMap.get(pAudio.assetId);
      if (!asset || !asset.audioBuffer) continue;
      audioClips.push({
        ...pAudio,
        buffer: asset.audioBuffer,
      });
    }

    return {
      assets,
      clips,
      audioClips,
      selection: payload.selection,
      activeTab: payload.activeTab,
      themeId: payload.themeId,
      aspectRatio: payload.aspectRatio,
      resolution: payload.resolution,
      exportFormat: payload.exportFormat ?? 'mp4',
      colorGrade: payload.colorGrade,
      particleOverlay: payload.particleOverlay,
      intro: payload.intro,
      outro: payload.outro,
      currentTimeSec: payload.currentTimeSec ?? 0,
      createdBlobUrls,
    };
  } catch {
    createdBlobUrls.forEach((u) => URL.revokeObjectURL(u));
    return null;
  } finally {
    db.close();
  }
}

export async function clearPersistedProject(): Promise<void> {
  const db = await openStudioDb();
  if (!db) return;

  try {
    const tx = db.transaction([STORE_MEDIA, STORE_PROJECT], 'readwrite');
    tx.objectStore(STORE_MEDIA).clear();
    tx.objectStore(STORE_PROJECT).clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  } finally {
    db.close();
  }
}
