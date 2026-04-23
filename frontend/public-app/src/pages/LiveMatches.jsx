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
          {matches.map((m) => {
            const sport = m.tournamentId?.sport || 'cricket';
            const ls = m.liveScore || {};

            // Build a live score line per sport
            let liveLine = null;
            if (sport === 'badminton' && ls.badmintonData) {
              const bd = ls.badmintonData;
              const t1 = bd.team1Points ?? 0;
              const t2 = bd.team2Points ?? 0;
              const game = bd.currentGame ?? 1;
              // gamesWon is serialized from a Map → plain object over JSON
              const gw = bd.gamesWon || {};
              const t1Id = String(m.team1Id?._id || m.team1Id || '');
              const t2Id = String(m.team2Id?._id || m.team2Id || '');
              const g1 = gw[t1Id] || 0;
              const g2 = gw[t2Id] || 0;
              liveLine = (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-800">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                    {t1} <span className="text-slate-400 dark:text-gray-500 font-normal">–</span> {t2}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-medium">
                    Game {game} · Games {g1}–{g2}
                  </p>
                </div>
              );
            } else if (sport === 'football' && ls.footballData) {
              const fd = ls.footballData;
              liveLine = (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-800">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                    {fd.homeGoals ?? 0} <span className="text-slate-400 dark:text-gray-500 font-normal">–</span> {fd.awayGoals ?? 0}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-medium capitalize">
                    {fd.currentHalf && fd.currentHalf !== 'not_started' ? fd.currentHalf.replace('_', ' ') : 'Kickoff'}
                    {fd.currentMinute ? ` · ${fd.currentMinute}'` : ''}
                  </p>
                </div>
              );
            } else if (sport === 'cricket' && Array.isArray(ls.innings) && ls.innings.length > 0) {
              const curIdx = Math.max(0, (ls.currentInnings || 1) - 1);
              const inn = ls.innings[curIdx] || ls.innings[ls.innings.length - 1];
              if (inn) {
                liveLine = (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-800">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                      {inn.totalRuns ?? 0}/{inn.totalWickets ?? 0}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 font-medium">
                      {(inn.totalOvers ?? 0)} ov · Innings {ls.currentInnings || 1}
                    </p>
                  </div>
                );
              }
            }

            return (
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

                {/* Teams + badminton category */}
                <div className="space-y-1">
                  <p className="text-slate-900 dark:text-white font-bold text-lg leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                    {m.team1Id?.name || 'Team A'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">vs</p>
                  <p className="text-slate-900 dark:text-white font-bold text-lg leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                    {m.team2Id?.name || 'Team B'}
                  </p>
                  {sport === 'badminton' && m.category && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                      {m.category}
                    </span>
                  )}
                </div>

                {/* Live score line (sport-aware) */}
                {liveLine}

                {/* Completion summary — shouldn't normally appear on a live match but kept for safety */}
                {!liveLine && m.result?.summary && (
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
            );
          })}
        </div>
      )}
    </div>
  );
}
