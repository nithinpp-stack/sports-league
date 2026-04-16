import React from 'react';

const STATUS_STYLES = {
  live:         'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 animate-pulse',
  active:       'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  upcoming:     'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  scheduled:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  completed:    'bg-slate-100 text-slate-500 border-slate-200 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600',
  registration: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  cancelled:    'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  paused:       'bg-slate-100 text-slate-600 border-slate-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600',
};

const FALLBACK = 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600';

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${STATUS_STYLES[status] || FALLBACK}`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
      {status}
    </span>
  );
}
