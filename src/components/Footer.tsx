import React from 'react';
import { ExternalLink } from 'lucide-react';
import { NilvidLogo } from './NilvidLogo';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800/80 bg-[#060911] mt-4">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <NilvidLogo size={20} />
          <span className="font-display font-semibold text-slate-200">
            Nilvid
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            A product by{' '}
            <span className="text-slate-200 font-medium">
              Nilam Creations (The Digital Hub)
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span>
            © {currentYear} Parth Prajapati. All rights reserved.
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            Founder & Developer:{' '}
            <a
              href="https://parth-prajapati4539.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#38BDF8] font-medium hover:text-sky-200 hover:underline underline-offset-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] rounded"
            >
              <span>Parth Prajapati</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
};
