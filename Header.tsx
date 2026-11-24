import React, { useState } from 'react';
import { Check, Copy, Download, FileCode2, Radio } from 'lucide-react';
import { copyTextSafely } from '../utils/clipboard';

export type AppTab = 'RADAR' | 'DUAL_VIEW' | 'HISTORY' | 'ANALYTICS' | 'MONITOR' | 'FAIRNESS';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  latencyMs: number;
  dataSourceMode: 'LIVE_CASINO_API' | 'ALGORITHMIC_SIMULATOR';
  onToggleDataSource: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'RADAR', label: 'Predictor' },
  { id: 'DUAL_VIEW', label: 'Dual Play' },
  { id: 'MONITOR', label: 'Monitor' },
  { id: 'HISTORY', label: 'History' },
  { id: 'ANALYTICS', label: 'Analytics' },
  { id: 'FAIRNESS', label: 'Verify & API' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  dataSourceMode,
  onToggleDataSource,
}) => {
  const isPractice = dataSourceMode === 'ALGORITHMIC_SIMULATOR';
  const [exportOpen, setExportOpen] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const handleBlobDownload = async (endpoint: string, filename: string) => {
    setExportBusy(true);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportOpen(false);
    } catch {
      // Fallback to direct navigation link if fetch blob fails
    } finally {
      setExportBusy(false);
    }
  };

  const handleCopyAllCode = async () => {
    setExportBusy(true);
    try {
      const res = await fetch('/api/export/codebase.md');
      if (!res.ok) throw new Error('Fetch failed');
      const text = await res.text();
      const ok = await copyTextSafely(text);
      if (ok) {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B14]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Clean Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('RADAR')}
          className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-slate-200 transition-colors"
        >
          AeroPredict
        </button>

        {/* Zone 2: Clean Single-Line Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 h-full overflow-x-auto no-scrollbar"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative h-full flex items-center text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{item.label}</span>
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-400 rounded-t-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Source Switch + Sanitized Project Export */}
        <div className="flex items-center gap-2 shrink-0 relative">
          <button
            type="button"
            onClick={() => setExportOpen((prev) => !prev)}
            className="h-9 px-3 rounded-lg border border-slate-700/80 bg-[#0D1320] hover:border-slate-600 text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            title="Download sanitized project ZIP or copy full codebase"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Export ZIP</span>
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-11 w-64 rounded-xl bg-[#0D1320] border border-slate-700/90 shadow-2xl p-2 space-y-1 z-50">
              <div className="px-2 py-1 text-[11px] font-medium text-slate-400">
                Sanitized Source Export
              </div>
              <button
                type="button"
                disabled={exportBusy}
                onClick={() =>
                  handleBlobDownload('/api/export/project.zip', 'aeropredict-sanitized-project.zip')
                }
                className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-800/80 text-left text-xs text-slate-100 flex items-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Download Project (.zip)</span>
              </button>
              <button
                type="button"
                disabled={exportBusy}
                onClick={() =>
                  handleBlobDownload('/api/export/codebase.md', 'aeropredict-complete-codebase.md')
                }
                className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-800/80 text-left text-xs text-slate-100 flex items-center gap-2 transition-colors"
              >
                <FileCode2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Download Single File (.md)</span>
              </button>
              <button
                type="button"
                disabled={exportBusy}
                onClick={handleCopyAllCode}
                className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-800/80 text-left text-xs text-slate-100 flex items-center gap-2 transition-colors"
              >
                {copiedAll ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span>{copiedAll ? 'Copied All 28 Files!' : 'Copy Full Codebase'}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleDataSource}
            className={`h-9 px-3.5 rounded-lg border text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors duration-150 ${
              isPractice
                ? 'bg-amber-500/10 border-amber-500/35 text-amber-300 hover:bg-amber-500/15'
                : 'bg-[#0D1320] border-slate-700/80 text-slate-200 hover:border-slate-600 hover:text-white'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isPractice ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span>{isPractice ? 'Practice Stream' : 'Live Feed'}</span>
          </button>
        </div>
      </div>

      {/* Compact Mobile Navigation Row */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-t border-slate-800/70 px-4 flex items-center gap-5 overflow-x-auto no-scrollbar"
      >
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{item.label}</span>
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-400 rounded-t-full" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
