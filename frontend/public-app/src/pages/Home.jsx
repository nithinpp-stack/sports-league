import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import dayjs from 'dayjs';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import { MapPin, ArrowRight, Activity, Trophy, Users, Zap } from '../components/ui/Icons';

const sports = ['all', 'cricket', 'football', 'badminton'];

export default function Home() {
  const [sportFilter, setSportFilter] = useState('all');

  const { data: liveMatches, isLoading: loadingLive } = useQuery({
    queryKey: ['liveMatches'],
    queryFn: () => api.get('/matches/live').then((r) => r.data),
  });

  const { data: tournaments, isLoading: loadingTournaments } = useQuery({
    queryKey: ['tournaments-home'],
    queryFn: () => api.get('/tournaments?limit=8').then((r) => r.data),
  });

  const allTournaments = Array.isArray(tournaments) ? tournaments : tournaments?.tournaments || [];
  const allLive = Array.isArray(liveMatches) ? liveMatches : liveMatches?.matches || [];

  const tournamentList = sportFilter === 'all' ? allTournaments : allTournaments.filter((t) => t.sport === sportFilter);
  const liveList = sportFilter === 'all' ? allLive : allLive.filter((m) => m.tournamentId?.sport === sportFilter);

  return (
    <div className="space-y-12">

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #6ee7b7 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent dark:from-gray-950/80" />

        <div className="relative z-10 text-center py-20 sm:py-28 px-6">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-emerald-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Tournaments &amp; Matches
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-5 tracking-tight leading-tight">
            Your Ultimate{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Sports League
            </span>
            <br />Platform
          </h1>
          <p className="text-slate-300 text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Track live scores, manage tournaments, and follow your favourite teams in real time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/tournaments"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-7 py-3 rounded-lg shadow-sm transition-all duration-200"
            >
              Browse Tournaments
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/matches/live"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold px-7 py-3 rounded-lg backdrop-blur-sm transition-all duration-200"
            >
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Watch Live
            </Link>
          </div>
        </div>
      </section>

      {/* Sport Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {sports.map((s) => (
          <button
            key={s}
            onClick={() => setSportFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all duration-200 ${
              sportFilter === s
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-900 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-gray-600 hover:text-emerald-700 dark:hover:text-white'
            }`}
          >
            {s === 'all' ? 'All Sports' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Live Matches */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Live Matches</h2>
          <Link
            to="/matches/live"
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            See All →
          </Link>
        </div>

        {loadingLive ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-100 dark:bg-gray-800 rounded-xl h-32 animate-pulse border border-slate-200 dark:border-gray-700" />
            ))}
          </div>
        ) : liveList.length === 0 ? (
          <EmptyState icon={Activity} title="No live matches" message="No live matches right now. Check back soon." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {liveList.map((match) => (
              <Link
                key={match._id}
                to={`/matches/${match._id}`}
                className="group bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-400 dark:hover:border-emerald-700 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-4">
                  <StatusBadge status="live" />
                  <span className="text-xs text-slate-500 dark:text-gray-400 font-medium bg-slate-50 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                    {match.tournamentId?.name || 'Tournament'}
                  </span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white text-base leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  {match.team1Id?.name || 'Team A'}{' '}
                  <span className="text-slate-300 dark:text-gray-600 font-normal">vs</span>{' '}
                  {match.team2Id?.name || 'Team B'}
                </p>
                {match.result && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3 font-medium">{match.result}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Tournaments */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Tournaments</h2>
          <Link
            to="/tournaments"
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            See All →
          </Link>
        </div>

        {loadingTournaments ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-100 dark:bg-gray-800 rounded-xl h-40 animate-pulse border border-slate-200 dark:border-gray-700" />
            ))}
          </div>
        ) : tournamentList.length === 0 ? (
          <EmptyState icon={Trophy} title="No tournaments yet" message="No tournaments available at the moment." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tournamentList.map((t) => (
              <Link
                key={t._id}
                to={`/tournaments/${t._id}`}
                className="group bg-white dark:bg-gray-900 rounded-2xl p-6 border border-slate-200 dark:border-gray-800 hover:border-emerald-400 dark:hover:border-emerald-700 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex justify-between items-start mb-4">
                  <StatusBadge status={t.status} />
                  <span className="text-xs text-slate-500 dark:text-gray-400 font-medium bg-slate-50 dark:bg-gray-800 px-2.5 py-1 rounded-full capitalize">{t.format}</span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-lg leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{t.name}</h3>
                {t.location && (
                  <p className="text-sm text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                    <MapPin size={14} className="text-slate-900 dark:text-gray-300" /> {t.location}
                  </p>
                )}
                <p className="text-sm text-slate-400 dark:text-gray-500 mt-2 flex items-center gap-1.5">
                  <ArrowRight size={14} className="text-slate-900 dark:text-gray-300" />
                  {dayjs(t.startDate).format('DD MMM YYYY')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Stats strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        {[
          { label: 'Live Matches', value: liveList.length, Icon: Activity, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
          { label: 'Tournaments', value: allTournaments.length, Icon: Trophy, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
          { label: 'Sports', value: 3, Icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { label: 'Auto Refresh', value: '10s', Icon: Zap, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-slate-200 dark:border-gray-800 text-center">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 ${stat.bg}`}>
              <stat.Icon size={24} className="text-slate-900 dark:text-white" />
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium mt-1">{stat.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
