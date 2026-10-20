import React from "react";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800/80 bg-[#09090b] text-zinc-400 text-xs transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 text-center sm:text-left">
            <div className="flex items-baseline font-bold tracking-tight text-base">
              <span className="text-tedx-red">TEDx</span>
              <span className="text-white">Gwarinpa</span>
              <span className="ml-1.5 text-zinc-400 font-normal">VolTex</span>
            </div>
            <span className="hidden sm:inline text-zinc-600">•</span>
            <p className="text-zinc-400 text-xs">
              TEDxGwarinpa 2026 Edition — Volunteer Ticket Promotion & Points Platform
            </p>
          </div>

          {/* Attribution / Copyright */}
          <div className="text-zinc-500 text-[11px] text-center sm:text-right shrink-0">
            <p>TEDxGwarinpa © 2026</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Operated under license from TED
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
