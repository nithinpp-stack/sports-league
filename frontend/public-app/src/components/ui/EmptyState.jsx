import React from 'react';
import { Link } from 'react-router-dom';
import { Search } from './Icons';

export default function EmptyState({ icon: IconComp, title, message, actionText, actionTo }) {
  const Ic = IconComp || Search;
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 flex items-center justify-center mb-4">
        <Ic size={24} className="text-slate-400 dark:text-gray-500" />
      </div>
      {title && <p className="text-base font-semibold text-slate-700 dark:text-gray-300 mb-1">{title}</p>}
      {message && <p className="text-sm text-slate-500 dark:text-gray-400 max-w-sm">{message}</p>}
      {actionText && actionTo && (
        <Link
          to={actionTo}
          className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        >
          {actionText} →
        </Link>
      )}
    </div>
  );
}
