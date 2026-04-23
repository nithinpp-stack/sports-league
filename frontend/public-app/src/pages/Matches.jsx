import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import dayjs from 'dayjs';
import { MapPin, Calendar, Trophy } from '../components/ui/Icons';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import { useAds, AdBanner, AdStrip } from '../components/AdComponents';

const SPORTS = ['all', 'cricket', 'football', 'badminton'];

export default function Matches() {
  const [statusFilter, setStatusFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const bannerAds = useAds('banner');
  const stripAds = useAds('strip');

  const { data, isLoading } = useQuery({
    queryKey: ['matches', statusFilter],
    queryFn: () =>
      api.get(`/matches${statusFilter ? `?status=${statusFilter}` : ''}`).then((r) => r.data),
  });

  const allMatches = data?.matches || [];
  const matches = sportFilter === 'all'
    ? allMatches
    : allMatches.filter((m) => m.tournamentId?.sport === sportFilter);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Matches</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 w-full sm:w-48 transition-all duration-200"
        >
          <option value="">All statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSportFilter(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-all duration-200 ${
              sportFilter === s
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 hover:border-emerald-300 dark:hover:border-gray-600 hover:text-emerald-700 dark:hover:text-white'
            }`}
          >
            {s === 'all' ? 'All Sports' : s}
          </button>
        ))}
      </div>

      {/* Ad Inline */}
      {bannerAds[0] && <div className="mb-6"><AdBanner ad={bannerAds[0]} /></div>}

      {isLoading ? (
        <Spinner />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No matches found"
          message="There are no matches matching your current filters."
        />
      ) : (
        <div className="space-y-3">
          {matches.map((m, index) => (
            <React.Fragment key={m._id}>
              <Link
                to={`/matches/${m._id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl px-6 py-5 transition-all duration-200 hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md gap-3 group"
              >
                <div className="flex-1">
                  <p className="text-slate-900 dark:text-white font-bold text-lg group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                    {m.team1Id?.name || 'TBD'}{' '}
                    <span className="text-slate-400 dark:text-gray-500 font-normal">vs</span>{' '}
                    {m.team2Id?.name || 'TBD'}
                    {m.tournamentId?.sport === 'badminton' && m.category && (
                      <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 align-middle">
                        {m.category}
                      </span>
                    )}
                  </p>
                  {m.tournamentId && (
                    <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium mt-0.5">{m.tournamentId?.name || m.tournamentId}</p>
                  )}
                  <p className="text-sm text-slate-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                    {m.venue && (
                      <>
                        <MapPin size={14} className="text-slate-400 dark:text-gray-500" />
                        <span>{m.venue}</span>
                        <span className="mx-1">·</span>
                      </>
                    )}
                    <Calendar size={14} className="text-slate-400 dark:text-gray-500" />
                    <span>{dayjs(m.date).format('DD MMM YYYY, HH:mm')}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {m.result?.summary && <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{m.result.summary}</span>}
                  <StatusBadge status={m.status} />
                </div>
              </Link>
              {/* Ad Strip after every 4th match — rotates through available strips */}
              {(index + 1) % 4 === 0 && index < matches.length - 1 && stripAds.length > 0 && (
                <AdStrip ad={stripAds[Math.floor((index + 1) / 4 - 1) % stripAds.length]} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
