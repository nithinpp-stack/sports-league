import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Activity, MapPin } from '../components/ui/Icons';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

export default function LiveMatches() {
  const { data, isLoading } = useQuery({
    queryKey: ['liveMatchesFull'],
    queryFn: () => api.get('/matches/live').then((r) => r.data),
    refetchInterval: 10000,
  });

  const matches = data?.matches || [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0"></span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Live Matches</h1>
        <span className="text-xs text-slate-500 dark:text-gray-400 ml-1">
          Auto-refreshes every 10s
        </span>
      </div>

      {isLoading ? (
        <Spinner />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No live matches"
          message="No live matches right now. Check back later."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {matches.map((m) => (
            <Link
              key={m._id}
              to={`/matches/${m._id}`}
              className="group bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-5 hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md transition-all duration-200"
            >
              {/* LIVE badge + tournament */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <StatusBadge status="live" />
                {m.tournamentId && (
                  <span className="text-xs text-slate-500 dark:text-gray-400 truncate font-medium">
                    {m.tournamentId?.name || m.tournamentId}
                  </span>
                )}
              </div>

              {/* Teams */}
              <div className="space-y-1">
                <p className="text-slate-900 dark:text-white font-bold text-lg leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                  {m.team1Id?.name || 'Team A'}
                </p>
                <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">vs</p>
                <p className="text-slate-900 dark:text-white font-bold text-lg leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                  {m.team2Id?.name || 'Team B'}
                </p>
              </div>

              {m.result?.summary && (
                <p className="text-emerald-600 dark:text-emerald-400 text-sm mt-3 font-medium border-t border-slate-200 dark:border-gray-800 pt-3">
                  {m.result.summary}
                </p>
              )}

              {m.venue && (
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                  <MapPin size={14} />
                  {m.venue}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
