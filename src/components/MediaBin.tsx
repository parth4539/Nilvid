import React, { useState } from 'react';
import {
  Film,
  Image as ImageIcon,
  Music,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { MediaAsset, MediaKind } from '../types/studio';

interface MediaBinProps {
  assets: MediaAsset[];
  isExporting: boolean;
  onOpenImportPicker: () => void;
  onFilesDropped: (files: FileList | File[]) => void;
  onLoadSamples: () => void;
  onAddAssetToTimeline: (asset: MediaAsset) => void;
  onRemoveAsset: (assetId: string) => void;
}

export const MediaBin: React.FC<MediaBinProps> = ({
  assets,
  isExporting,
  onOpenImportPicker,
  onFilesDropped,
  onLoadSamples,
  onAddAssetToTimeline,
  onRemoveAsset,
}) => {
  const [filter, setFilter] = useState<'all' | 'visual' | 'audio'>('all');
  const [isDragOver, setIsDragOver] = useState(false);

  const filteredAssets = assets.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'visual') return a.kind === 'image' || a.kind === 'video';
    return a.kind === 'audio';
  });

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      setIsDragOver(false);
      onFilesDropped(e.dataTransfer.files);
    }
  };

  const renderKindIcon = (kind: MediaKind) => {
    if (kind === 'video') return <Film className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />;
    if (kind === 'audio') return <Music className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />;
    return <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />;
  };

  return (
    <aside
      aria-label="Project Media Bin"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-[#0E1424] border rounded-2xl overflow-hidden flex flex-col transition-colors ${
        isDragOver ? 'border-[#38BDF8] bg-slate-900/70' : 'border-slate-800/90'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800/90 space-y-3 bg-[#090E1B]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Media Bin
          </h2>
          <span className="font-mono text-xs text-slate-400">
            {assets.length} items
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isExporting}
            onClick={onOpenImportPicker}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-45 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Import Media</span>
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={onLoadSamples}
            title="Load sample photos"
            aria-label="Load sample photos"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#0E1424] border border-slate-800 text-sky-400 hover:border-slate-700 hover:text-sky-300 transition-colors cursor-pointer disabled:opacity-45 shrink-0"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div
          role="group"
          aria-label="Filter project media"
          className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#070A12] border border-slate-800"
        >
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'visual', label: 'Photo/Video' },
              { id: 'audio', label: 'Audio' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`py-1 px-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-[#172554] text-sky-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset List */}
      <div className="p-3 space-y-2 max-h-[460px] overflow-y-auto flex-1">
        {filteredAssets.length === 0 ? (
          <div
            onClick={!isExporting ? onOpenImportPicker : undefined}
            className="border border-dashed border-slate-800 rounded-xl py-8 px-4 text-center cursor-pointer hover:border-sky-500/50 transition-colors"
          >
            <p className="text-xs font-medium text-slate-300">
              Drop images, videos, or songs
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Drag items from here onto the timeline
            </p>
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <div
              key={asset.id}
              draggable={!isExporting}
              onDragStart={(e) => {
                if (isExporting) return;
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/x-nilvid-asset', asset.id);
              }}
              className="group flex items-center gap-2.5 p-2 rounded-xl bg-[#090E1B] border border-slate-800/90 hover:border-slate-700 transition-colors cursor-grab active:cursor-grabbing"
            >
              {/* Thumbnail */}
              <div className="w-14 h-10 rounded-lg bg-slate-950 overflow-hidden shrink-0 flex items-center justify-center border border-slate-800">
                {asset.kind === 'audio' ? (
                  <Music className="w-4 h-4 text-sky-400" aria-hidden="true" />
                ) : asset.thumbnailUrl ? (
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Film className="w-4 h-4 text-sky-400" aria-hidden="true" />
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {renderKindIcon(asset.kind)}
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {asset.name}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                  {asset.kind === 'image'
                    ? 'Image · 5.0s'
                    : `${asset.kind === 'video' ? 'Video' : 'Audio'} · ${asset.durationSec.toFixed(1)}s`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => onAddAssetToTimeline(asset)}
                  title="Add to timeline"
                  aria-label={`Add ${asset.name} to timeline`}
                  className="w-7 h-7 rounded-lg bg-[#172554] text-sky-200 hover:bg-[#2563EB] hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => onRemoveAsset(asset.id)}
                  title="Remove from Media Bin"
                  aria-label={`Remove ${asset.name} from media bin`}
                  className="w-7 h-7 rounded-lg bg-[#0E1424] text-slate-500 hover:text-rose-400 flex items-center justify-center opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer disabled:pointer-events-none"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-800/80 bg-[#080C16] text-[11px] text-slate-500">
        Drag media onto Track V1 or Track A1 below
      </div>
    </aside>
  );
};
