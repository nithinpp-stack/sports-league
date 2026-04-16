import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import dayjs from 'dayjs';
import { MapPin, Calendar, Trophy } from '../components/ui/Icons';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';

const SPORTS = ['all', 'cricket', 'football'];

export default function Tournaments() {
  const [statusFilter, setStatusFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['tournaments', statusFilter],
    queryFn: () =>
      api.get(`/tournaments${statusFilter ? `?status=${statusFilter}` : ''}`).then((r) => r.data),
  });

  const allTournaments = data?.tournaments || [];
  const list = sportFilter === 'all'
    ? allTournaments
    : allTournaments.filter((t) => t.sport === sportFilter);

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
          {list.map((t) => (
            <Link
              key={t._id}
              to={`/tournaments/${t._id}`}
              className="group bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-6 hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <StatusBadge status={t.status} />
                <span className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wide font-medium">{t.format}</span>
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug">
                {t.name}
              </h3>
              {t.location && (
                <p className="text-sm text-slate-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-400 dark:text-gray-500" />
                  {t.location}
                </p>
              )}
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-3 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400 dark:text-gray-500" />
                {t.startDate ? dayjs(t.startDate).format('DD MMM YYYY') : 'TBD'}
                {t.endDate ? ` - ${dayjs(t.endDate).format('DD MMM YYYY')}` : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
