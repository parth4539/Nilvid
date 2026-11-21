import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  ImagePlus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { getAnimationLabel, getTransitionLabel } from '../engine/catalog';
import { SlideScheduleItem } from '../types/studio';

interface MediaFilmstripProps {
  schedule: SlideScheduleItem[];
  selectedSlideId: string | null;
  currentTimeSec: number;
  isExporting: boolean;
  onOpenFilePicker: () => void;
  onFilesDropped: (files: FileList | File[]) => void;
  onLoadSamples: () => void;
  onClearAll: () => void;
  onMoveSlide: (index: number, direction: -1 | 1) => void;
  onReorderSlide: (fromIndex: number, toIndex: number) => void;
  onDuplicateSlide: (slideId: string) => void;
  onRemoveSlide: (id: string) => void;
  onSelectAndJumpToSlide: (slideId: string, timeSec: number) => void;
}

export const MediaFilmstrip: React.FC<MediaFilmstripProps> = ({
  schedule,
  selectedSlideId,
  currentTimeSec,
  isExporting,
  onOpenFilePicker,
  onFilesDropped,
  onLoadSamples,
  onClearAll,
  onMoveSlide,
  onReorderSlide,
  onDuplicateSlide,
  onRemoveSlide,
  onSelectAndJumpToSlide,
}) => {
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleContainerDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsFileDragOver(true);
    }
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragOver(false);
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      setIsFileDragOver(false);
      onFilesDropped(e.dataTransfer.files);
    }
  };

  return (
    <section
      id="timeline"
      aria-label="Media Sequence"
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
      className={`bg-[#0E1424] border rounded-2xl p-5 space-y-4 transition-colors ${
        isFileDragOver ? 'border-[#38BDF8] bg-slate-900/70' : 'border-slate-800/90'
      }`}
    >
      {/* Filmstrip Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Sequence Filmstrip
          </h2>
          <p className="text-xs text-slate-400">
            {schedule.length}{' '}
            {schedule.length === 1 ? 'image' : 'images'}
            <span aria-hidden="true"> · </span>
            Drag cards to reorder, or click any frame to edit animation & caption
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={onOpenFilePicker}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] transition-colors cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <ImagePlus className="w-4 h-4" aria-hidden="true" />
            <span>Add Images</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={onLoadSamples}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-[#090E1B] border border-slate-800 text-slate-300 text-xs font-medium hover:text-slate-100 hover:border-slate-700 transition-colors cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
            <span>Load Samples</span>
          </button>

          {schedule.length > 0 && (
            <button
              type="button"
              disabled={isExporting}
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-[#090E1B] border border-slate-800 text-slate-400 text-xs font-medium hover:text-rose-300 hover:border-rose-500/40 transition-colors cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Filmstrip Cards or Empty Drop Target */}
      {schedule.length === 0 ? (
        <div
          onClick={!isExporting ? onOpenFilePicker : undefined}
          className="border border-dashed border-slate-700/80 rounded-xl py-10 px-6 text-center cursor-pointer hover:border-[#38BDF8] transition-colors"
        >
          <p className="text-sm font-medium text-slate-200">
            Drag and drop multiple images here, or click to browse
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Supports JPG, PNG, WebP, and GIF
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
          {schedule.map((item, idx) => {
            const isPlayheadHere =
              currentTimeSec >= item.startTime &&
              currentTimeSec <= item.endTime;
            const isSelected = selectedSlideId === item.slide.id;
            const isLast = idx === schedule.length - 1;
            const isBeingDragged = draggedIndex === idx;
            const isDropTarget = dragOverIndex === idx && draggedIndex !== idx;

            return (
              <div
                key={item.slide.id}
                draggable={!isExporting}
                onDragStart={(e) => {
                  if (isExporting) return;
                  setDraggedIndex(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(idx));
                }}
                onDragOver={(e) => {
                  if (draggedIndex === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== idx) {
                    setDragOverIndex(idx);
                  }
                }}
                onDrop={(e) => {
                  if (draggedIndex === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedIndex !== idx) {
                    onReorderSlide(draggedIndex, idx);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`group rounded-xl border bg-[#090E1B] overflow-hidden flex flex-col transition-all ${
                  isBeingDragged ? 'opacity-45 scale-[0.98]' : ''
                } ${
                  isDropTarget
                    ? 'border-[#38BDF8] ring-2 ring-[#38BDF8]/40'
                    : isSelected
                    ? 'border-[#38BDF8]'
                    : isPlayheadHere
                    ? 'border-sky-600/60'
                    : 'border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-slate-950 overflow-hidden">
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() =>
                      onSelectAndJumpToSlide(item.slide.id, item.soloStartTime)
                    }
                    className="w-full h-full block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#38BDF8]"
                    aria-label={`Select and jump to slide ${idx + 1}: ${item.slide.name}`}
                  >
                    <img
                      src={item.slide.url}
                      alt={item.slide.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </button>

                  {/* Drag Handle */}
                  <div
                    aria-hidden="true"
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded bg-slate-950/75 text-slate-300 flex items-center justify-center opacity-75 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-grab"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => onRemoveSlide(item.slide.id)}
                    aria-label={`Remove ${item.slide.name}`}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md bg-slate-950/80 text-slate-300 hover:text-white hover:bg-rose-600 flex items-center justify-center opacity-85 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer disabled:pointer-events-none"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                {/* Metadata + Actions */}
                <div className="p-2.5 flex flex-col gap-1.5 flex-1 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200 truncate">
                      <span className="font-mono text-slate-500">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className="truncate">{item.slide.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {getAnimationLabel(item.animationId)}
                      {!isLast && (
                        <>
                          <span aria-hidden="true"> · </span>
                          {getTransitionLabel(item.transitionOutType)}
                        </>
                      )}
                    </p>
                    {item.slide.caption && (
                      <p className="text-[11px] text-[#38BDF8] truncate mt-0.5">
                        Caption: {item.slide.caption}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/70">
                    <span className="font-mono text-[11px] text-slate-500">
                      {(item.endTime - item.startTime).toFixed(1)}s
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => onDuplicateSlide(item.slide.id)}
                        aria-label={`Duplicate ${item.slide.name}`}
                        title="Duplicate slide"
                        className="w-7 h-7 rounded bg-[#0E1424] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                      >
                        <Copy className="w-3 h-3" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0 || isExporting}
                        onClick={() => onMoveSlide(idx, -1)}
                        aria-label={`Move ${item.slide.name} earlier`}
                        className="w-7 h-7 rounded bg-[#0E1424] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast || isExporting}
                        onClick={() => onMoveSlide(idx, 1)}
                        aria-label={`Move ${item.slide.name} later`}
                        className="w-7 h-7 rounded bg-[#0E1424] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
