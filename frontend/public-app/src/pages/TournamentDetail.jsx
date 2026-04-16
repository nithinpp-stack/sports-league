import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { MapPin, Calendar } from '../components/ui/Icons';

const TABS = ['Overview', 'Standings', 'Matches', 'Teams'];

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [registered, setRegistered] = useState(false);

  const { data: tournament, isLoading: tLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.get(`/tournaments/${id}`).then((r) => r.data.tournament),
  });

  const { data: teamsData } = useQuery({
    queryKey: ['tournament-teams', id],
    queryFn: () => api.get(`/tournaments/${id}/teams`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: matchesData } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => api.get(`/matches?tournamentId=${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: standingsData } = useQuery({
    queryKey: ['tournament-standings', id],
    queryFn: () => api.get(`/tournaments/${id}/standings`).then((r) => r.data),
    enabled: !!id,
  });

  const registerMutation = useMutation({
    mutationFn: () => api.post('/players/register-tournament', { tournamentId: id }),
    onSuccess: () => {
      setRegistered(true);
      toast.success('Registration submitted! Awaiting admin approval.');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Registration failed'),
  });

  const teams = teamsData?.teams || [];
  const matches = matchesData?.matches || [];
  const standings = standingsData?.standings || [];
  const sport = tournament?.sport || 'cricket';
  const canRegister = user?.role === 'player' && (tournament?.status === 'registration' || tournament?.status === 'active');

  if (tLoading) {
    return <Spinner />;
  }

  if (!tournament) {
    return <p className="text-slate-500 dark:text-gray-400 text-center py-16">Tournament not found.</p>;
  }

  const thTd = 'px-4 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider';
  const td = 'px-4 py-3 text-center text-slate-600 dark:text-gray-300';

  return (
    <div>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-slate-200 dark:border-gray-700 mb-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{tournament.name}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-gray-400">
              {tournament.format && <span className="capitalize">Format: {tournament.format}</span>}
              {tournament.location && <span className="flex items-center gap-1"><MapPin size={14} /> {tournament.location}</span>}
              {tournament.startDate && <span className="flex items-center gap-1"><Calendar size={14} /> {dayjs(tournament.startDate).format('DD MMM YYYY')}</span>}
            </div>
          </div>
          <StatusBadge status={tournament.status} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-4 text-sm font-medium transition-all duration-200 ${
              activeTab === tab
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 dark:border-emerald-400'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'Overview' && (
        <div className="space-y-4">
          {canRegister && (
            <div className="bg-emerald-50 dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <p className="text-slate-700 dark:text-gray-300 text-sm">
                {registered
                  ? 'Your registration is pending admin approval.'
                  : 'Interested in playing? Register now for this tournament.'}
              </p>
              {registered ? (
                <button disabled className="px-4 py-2 bg-slate-100 dark:bg-gray-600 text-slate-400 dark:text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed">
                  Registration Pending
                </button>
              ) : (
                <button
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                >
                  {registerMutation.isPending ? 'Registering...' : 'Register'}
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Teams', value: teams.length },
              { label: 'Matches', value: matches.length },
              { label: 'Format', value: tournament.format || '–' },
              { label: 'Status', value: tournament.status },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700 text-center shadow-sm">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 capitalize">{stat.value}</p>
                <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standings */}
      {activeTab === 'Standings' && (
        <div className="overflow-x-auto bg-white dark:bg-transparent rounded-xl border border-slate-200 dark:border-transparent shadow-sm dark:shadow-none">
          {standings.length === 0 ? (
            <p className="text-slate-500 dark:text-gray-400 p-6">No standings available yet.</p>
          ) : sport === 'cricket' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-transparent">
                  <th className={`${thTd} text-left`}>#</th>
                  <th className={`${thTd} text-left`}>Team</th>
                  <th className={thTd}>P</th>
                  <th className={thTd}>W</th>
                  <th className={thTd}>L</th>
                  <th className={`${thTd} text-emerald-600 dark:text-emerald-400`}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, idx) => (
                  <tr key={row.team?._id || idx} className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 dark:text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {row.team?.name || row.teamName || 'Unknown'}
                    </td>
                    <td className={td}>{row.played ?? row.P ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">{row.won ?? row.W ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-500 dark:text-red-400">{row.lost ?? row.L ?? 0}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">{row.points ?? row.Pts ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-transparent">
                  <th className={`${thTd} text-left`}>#</th>
                  <th className={`${thTd} text-left`}>Team</th>
                  <th className={thTd}>P</th>
                  <th className={thTd}>W</th>
                  <th className={thTd}>D</th>
                  <th className={thTd}>L</th>
                  <th className={thTd}>GD</th>
                  <th className={`${thTd} text-emerald-600 dark:text-emerald-400`}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, idx) => (
                  <tr key={row.team?._id || idx} className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 dark:text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {row.team?.name || row.teamName || 'Unknown'}
                    </td>
                    <td className={td}>{row.played ?? row.P ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-emerald-600 dark:text-emerald-400">{row.won ?? row.W ?? 0}</td>
                    <td className={td}>{row.drawn ?? row.D ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-red-500 dark:text-red-400">{row.lost ?? row.L ?? 0}</td>
                    <td className={td}>
                      {row.goalDifference != null
                        ? (row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference)
                        : row.GD ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">{row.points ?? row.Pts ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Matches */}
      {activeTab === 'Matches' && (
        <div className="space-y-3">
          {matches.length === 0 ? (
            <p className="text-slate-500 dark:text-gray-400">No matches scheduled yet.</p>
          ) : (
            matches.map((m) => (
              <Link
                key={m._id}
                to={`/matches/${m._id}`}
                className="flex items-center justify-between bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-xl px-5 py-4 transition-all duration-200 shadow-sm group"
              >
                <div>
                  <p className="text-slate-900 dark:text-white font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                    {m.team1Id?.name || 'TBD'} vs {m.team2Id?.name || 'TBD'}
                  </p>
                  <p className="text-slate-400 dark:text-gray-400 text-sm mt-0.5">{dayjs(m.date).format('DD MMM YYYY, HH:mm')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {m.result?.summary && <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{m.result.summary}</span>}
                  <StatusBadge status={m.status} />
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Teams */}
      {activeTab === 'Teams' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.length === 0 ? (
            <p className="text-slate-500 dark:text-gray-400">No teams yet.</p>
          ) : (
            teams.map((team) => (
              <Link
                key={team._id}
                to={`/teams/${team._id}`}
                className="group bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-800 rounded-xl p-5 transition-all duration-200 hover:shadow-md"
              >
                <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{team.name}</h3>
                {team.owner && <p className="text-slate-500 dark:text-gray-400 text-sm">Owner: {team.owner.name || team.owner}</p>}
                {team.budget != null && (
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm mt-1 font-medium">Budget: ₹{team.budget?.toLocaleString()}</p>
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
