import React, { useState, useEffect } from 'react';
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

const SPORT_IMAGES = {
  cricket: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&h=300&fit=crop&crop=center',
  football: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=300&fit=crop&crop=center',
  badminton: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&h=300&fit=crop&crop=center',
};
const SPORT_EMOJI = { cricket: '🏏', football: '⚽', badminton: '🏸' };

function UpcomingMatchTicker({ matches }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (matches.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % matches.length), 5000);
    return () => clearInterval(timer);
  }, [matches.length]);

  if (!matches.length) return null;
  const m = matches[index];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-gray-800">
      <img
        src={SPORT_IMAGES[m.tournamentId?.sport] || SPORT_IMAGES.cricket}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />

      <div className="relative z-10 p-8 sm:p-12 py-24 sm:py-36 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Upcoming
            </span>
            <span className="text-white/40 text-xs font-medium">{index + 1} / {matches.length}</span>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white leading-tight mb-2">
            {m.team1Id?.name || 'Team A'} <span className="text-white/40 font-normal">vs</span> {m.team2Id?.name || 'Team B'}
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300">
            {m.tournamentId?.name && (
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                <Trophy size={11} /> {m.tournamentId.name}
              </span>
            )}
            {m.venue && (
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                <MapPin size={11} /> {m.venue}
              </span>
            )}
            {m.date && (
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                <Calendar size={11} /> {dayjs(m.date).format('DD MMM · h:mm A')}
              </span>
            )}
          </div>
        </div>
        <Link
          to={`/matches/${m._id}`}
          className="shrink-0 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold rounded-xl transition-colors"
        >
          View →
        </Link>
      </div>

      {/* Progress dots */}
      {matches.length > 1 && (
        <div className="relative z-10 flex justify-center gap-1.5 pb-4">
          {matches.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === index ? 'bg-white w-5' : 'bg-white/30 hover:bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Tournaments() {
  const [statusFilter, setStatusFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const bannerAds = useAds('banner');
  const stripAds = useAds('strip');

  const { data, isLoading } = useQuery({
    queryKey: ['tournaments', statusFilter],
    queryFn: () =>
      api.get(`/tournaments${statusFilter ? `?status=${statusFilter}` : ''}`).then((r) => r.data),
  });

  const { data: upcomingMatchesData } = useQuery({
    queryKey: ['upcoming-matches'],
    queryFn: () => api.get('/matches?status=upcoming&limit=8').then((r) => r.data),
  });

  const allTournaments = data?.tournaments || [];
  const list = sportFilter === 'all'
    ? allTournaments
    : allTournaments.filter((t) => t.sport === sportFilter);

  const upcomingMatches = (upcomingMatchesData?.matches || []).slice(0, 6);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tournaments</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 w-full sm:w-48 transition-all duration-200"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="registration">Registration</option>
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
                : 'bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 hover:border-emerald-400 dark:hover:border-gray-600 hover:text-emerald-700 dark:hover:text-white'
            }`}
          >
            {s === 'all' ? 'All Sports' : s}
          </button>
        ))}
      </div>

      {/* Upcoming Match Ticker */}
      {upcomingMatches.length > 0 && (
        <div className="mb-8">
          <UpcomingMatchTicker matches={upcomingMatches} />
        </div>
      )}

      {/* Ad Banner */}
      {bannerAds[0] && <div className="mb-8"><AdBanner ad={bannerAds[0]} /></div>}

      {isLoading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments found"
          message="There are no tournaments matching your filters."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((t, i) => (
            <React.Fragment key={t._id}>
              <Link
                to={`/tournaments/${t._id}`}
                className="group bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md transition-all duration-200"
              >
                {/* Sport image header */}
                <div className="relative h-28 overflow-hidden">
                  <img
                    src={SPORT_IMAGES[t.sport] || SPORT_IMAGES.cricket}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                    <StatusBadge status={t.status} />
                    <span className="text-xs text-white/80 uppercase tracking-wide font-medium">{t.format}</span>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug">
                    {t.name}
                  </h3>
                  {t.location && (
                    <p className="text-sm text-slate-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400 dark:text-gray-500" />
                      {t.location}
                    </p>
                  )}
                  <p className="text-sm text-slate-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400 dark:text-gray-500" />
                    {t.startDate ? dayjs(t.startDate).format('DD MMM YYYY') : 'TBD'}
                    {t.endDate ? ` - ${dayjs(t.endDate).format('DD MMM YYYY')}` : ''}
                  </p>
                  {t.sport && (
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-2 capitalize">{SPORT_EMOJI[t.sport] || ''} {t.sport}</p>
                  )}
                </div>
              </Link>

              {/* Ad strip after every 3rd card — rotates through strips */}
              {(i + 1) % 3 === 0 && i < list.length - 1 && stripAds.length > 0 && (
                <div className="sm:col-span-2 lg:col-span-3 py-1">
                  <AdStrip ad={stripAds[Math.floor((i + 1) / 3 - 1) % stripAds.length]} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
