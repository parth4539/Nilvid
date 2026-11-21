import React, { useEffect, useState } from 'react';
import { Download, Film, X } from 'lucide-react';
import { formatBytes } from '../engine/exporter';
import { ExportResult } from '../types/studio';

interface ExportPreviewModalProps {
  result: ExportResult | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  result,
  isOpen,
  onClose,
  onDownload,
}) => {
  const [playbackUnsupported, setPlaybackUnsupported] = useState(false);

  useEffect(() => {
    setPlaybackUnsupported(false);
  }, [result?.blobUrl, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !result) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-preview-title"
      className="fixed inset-0 z-50 bg-[#04070E]/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[#0E1424] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div className="min-w-0">
            <h3
              id="export-preview-title"
              className="font-display text-base font-semibold text-slate-100 truncate"
            >
              {result.filename}
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {result.width}×{result.height} · {result.format.toUpperCase()} ·{' '}
              {result.durationSec.toFixed(1)}s · {formatBytes(result.sizeBytes)}
              {result.hasAudio ? ' · Audio included' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close exported video preview"
            className="w-10 h-10 rounded-lg bg-[#090E1B] border border-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="bg-black p-3 sm:p-5 flex items-center justify-center min-h-[260px]">
          {playbackUnsupported ? (
            <div className="py-10 px-6 text-center max-w-md space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#090E1B] border border-slate-800 flex items-center justify-center text-sky-400 mx-auto">
                <Film className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-slate-100">
                Your {result.format.toUpperCase()} file is ready to download
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                This browser&apos;s inline player cannot preview{' '}
                <span className="font-mono text-slate-200">
                  .{result.format}
                </span>{' '}
                containers directly. Click Download to save and open it in
                QuickTime, Premiere Pro, or VLC.
              </p>
            </div>
          ) : (
            <video
              src={result.blobUrl}
              controls
              autoPlay
              loop
              playsInline
              onError={() => setPlaybackUnsupported(true)}
              className="max-h-[65vh] w-auto rounded-lg"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-[#090E1B] border border-slate-800 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Download {result.format.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
