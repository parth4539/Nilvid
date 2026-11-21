import React from 'react';
import { Download } from 'lucide-react';
import { InspectorTab } from '../types/studio';
import { NilvidLogo } from './NilvidLogo';

interface HeaderProps {
  canExport: boolean;
  isExporting: boolean;
  onExportClick: () => void;
  onNavigateTab: (tab: InspectorTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  canExport,
  isExporting,
  onExportClick,
  onNavigateTab,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#070A12]/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand mark + single-line wordmark */}
        <a
          href="#studio"
          className="inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] rounded"
        >
          <NilvidLogo size={34} />
          <span>Nilvid</span>
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400"
        >
          <a
            href="#studio"
            onClick={() => onNavigateTab('theme')}
            className="hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Studio
          </a>
          <a
            href="#inspector"
            onClick={() => onNavigateTab('clip')}
            className="hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Animations
          </a>
          <a
            href="#inspector"
            onClick={() => onNavigateTab('look')}
            className="hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Filters & FX
          </a>
          <a
            href="#inspector"
            onClick={() => onNavigateTab('titles')}
            className="hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Audio & Titles
          </a>
          <a
            href="#timeline"
            className="hover:text-sky-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Timeline
          </a>
        </nav>

        {/* Zone 3: Single primary action button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onExportClick}
            disabled={!canExport || isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070A12]"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>{isExporting ? 'Exporting...' : 'Export Video'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
