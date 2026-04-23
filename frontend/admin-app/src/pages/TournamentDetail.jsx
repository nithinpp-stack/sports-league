import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import Select from '../components/ui/Select';

import TournamentOverview from './tournament/TournamentOverview';
import TournamentTeams from './tournament/TournamentTeams';
import TournamentMatches from './tournament/TournamentMatches';
import TournamentPlayers from './tournament/TournamentPlayers';
import TournamentManagers from './tournament/TournamentManagers';

const TABS = [
  { key: 'matches', label: 'Matches' },
  { key: 'teams', label: 'Teams' },
  { key: 'manager', label: 'Managers' },
  { key: 'players', label: 'Players' },
];

export default function TournamentDetail() {
  const { id } = useParams();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('matches');
  const [editingTournament, setEditingTournament] = useState(false);
  const [tournamentEditForm, setTournamentEditForm] = useState({});

  // Core tournament data
  const { data: tournament, isLoading: tLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.get(`/tournaments/${id}`).then((r) => r.data),
  });

  // Teams data — needed by Overview (stats) and Matches (team selects)
  const { data: teamsData } = useQuery({
    queryKey: ['tournament-teams', id],
    queryFn: () => api.get(`/tournaments/${id}/teams`).then((r) => r.data),
    enabled: !!id,
  });

  // Matches data — needed by Overview (stats)
  const { data: matchesData } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => api.get(`/tournaments/${id}/matches`).then((r) => r.data),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status) => api.patch(`/tournaments/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status updated!');
      qc.invalidateQueries(['tournament', id]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update status'),
  });

  const updateTournamentMutation = useMutation({
    mutationFn: (data) => api.put(`/tournaments/${id}`, data),
    onSuccess: () => {
      toast.success('Tournament updated!');
      qc.invalidateQueries(['tournament', id]);
      setEditingTournament(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update tournament'),
  });

  const t = tournament?.tournament ?? tournament;
  const teams = Array.isArray(teamsData) ? teamsData : teamsData?.teams ?? [];
  const matches = Array.isArray(matchesData) ? matchesData : matchesData?.matches ?? [];

  if (tLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!t) return <p className="text-gray-400 text-center py-16">Tournament not found.</p>;

  return (
    <div className="space-y-6">
      {/* Tournament Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        {editingTournament ? (
          <form
            onSubmit={(e) => { e.preventDefault(); updateTournamentMutation.mutate(tournamentEditForm); }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-700">Edit Tournament Details</h3>
              <button type="button" onClick={() => setEditingTournament(false)} className="text-gray-400 hover:text-gray-600 text-sm">
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input required value={tournamentEditForm.name ?? ''} onChange={(e) => setTournamentEditForm({ ...tournamentEditForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                <Select value={tournamentEditForm.format ?? ''} onChange={(e) => setTournamentEditForm({ ...tournamentEditForm, format: e.target.value })} className="w-full">
                  <option value="round_robin">Round Robin</option>
                  <option value="knockout">Knockout</option>
                  <option value="league">League</option>
                  <option value="t20">T20</option>
                  <option value="odi">ODI</option>
                  <option value="test">Test</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input value={tournamentEditForm.location ?? ''} onChange={(e) => setTournamentEditForm({ ...tournamentEditForm, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                <input value={tournamentEditForm.venue ?? ''} onChange={(e) => setTournamentEditForm({ ...tournamentEditForm, venue: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" value={tournamentEditForm.startDate ? tournamentEditForm.startDate.slice(0, 10) : ''} onChange={(e) => setTournamentEditForm({ ...tournamentEditForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" value={tournamentEditForm.endDate ? tournamentEditForm.endDate.slice(0, 10) : ''} onChange={(e) => setTournamentEditForm({ ...tournamentEditForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={3} value={tournamentEditForm.description ?? ''} onChange={(e) => setTournamentEditForm({ ...tournamentEditForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={updateTournamentMutation.isPending}
                className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60">
                {updateTournamentMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-gray-800">{t.name}</h2>
                <Select
                  value={t.status}
                  onChange={(e) => statusMutation.mutate(e.target.value)}
                  className="w-auto"
                >
                  <option value="draft">Draft</option>
                  <option value="registration">Registration</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </Select>
              </div>
              <p className="text-gray-500 text-sm mt-1 capitalize">{t.format?.replace(/_/g, ' ')} &bull; {t.location || 'No location'}</p>
              {t.venue && <p className="text-gray-500 text-sm mt-0.5">{t.venue}</p>}
              {(t.startDate || t.endDate) && (
                <p className="text-gray-400 text-xs mt-1">
                  {t.startDate ? new Date(t.startDate).toLocaleDateString() : '—'} &ndash; {t.endDate ? new Date(t.endDate).toLocaleDateString() : '—'}
                </p>
              )}
              {t.description && <p className="text-gray-600 mt-2 text-sm">{t.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTournamentEditForm({ name: t.name ?? '', format: t.format ?? 'round_robin', location: t.location ?? '', venue: t.venue ?? '', startDate: t.startDate ?? '', endDate: t.endDate ?? '', description: t.description ?? '' });
                  setEditingTournament(true);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
              {/* Auctions only make sense for cricket — badminton / football tournaments
                  don't have the points-based bidding flow, so hide the shortcut there. */}
              {t.sport === 'cricket' && (
                <Link to={`/auctions/${id}`} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Auction Control
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex items-center gap-1 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'matches' && <TournamentMatches tournament={t} teams={teams} id={id} />}
      {activeTab === 'teams' && <TournamentTeams tournament={t} id={id} />}
      {activeTab === 'manager' && <TournamentManagers tournament={t} id={id} />}
      {activeTab === 'players' && <TournamentPlayers tournament={t} id={id} />}
    </div>
  );
}
