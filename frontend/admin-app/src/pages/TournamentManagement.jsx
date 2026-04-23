import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';
import Select from '../components/ui/Select';
import { useConfirm } from '../components/ui/ConfirmModal';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  registration: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-purple-100 text-purple-700',
};

const FORMATS_BY_SPORT = {
  cricket: ['T20', 'ODI', 'Test'],
  football: ['League', 'Cup', 'Friendly'],
  // BWF tournament formats — Singles/Doubles etc. are match categories, not tournament formats
  badminton: ['Knockout', 'Round Robin', 'Group + Knockout', 'Double Elimination'],
};

const SPORT_BADGE_COLORS = {
  cricket: 'bg-emerald-100 text-emerald-700',
  football: 'bg-blue-100 text-blue-700',
  badminton: 'bg-purple-100 text-purple-700',
};

export default function TournamentManagement() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    name: '',
    sport: 'cricket',
    format: 'T20',
    location: '',
    venue: '',
    maxTeams: 8,
    description: '',
  });

  const { data: tournamentsData, isLoading } = useQuery({
    queryKey: ['tournaments', page],
    queryFn: () => api.get(`/tournaments?page=${page}&limit=10`).then((r) => r.data),
  });

  const { data: myTeamData } = useQuery({
    queryKey: ['my-team'],
    queryFn: () => api.get('/teams/my-team').then((r) => r.data),
    enabled: isManager,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/tournaments', data),
    onSuccess: () => {
      toast.success('Tournament created!');
      qc.invalidateQueries(['tournaments']);
      setShowForm(false);
      setForm({ name: '', sport: 'cricket', format: 'T20', location: '', venue: '', maxTeams: 8, description: '' });
      setPage(1);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create tournament'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/tournaments/${id}`),
    onSuccess: () => {
      toast.success('Tournament deleted!');
      qc.invalidateQueries(['tournaments']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete tournament'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const handleDelete = async (t) => {
    if (!await confirm(`Delete tournament "${t.name}"?`, { message: 'This cannot be undone.', variant: 'danger', confirmText: 'Delete' })) return;
    deleteMutation.mutate(t._id);
  };

  const allTournaments = Array.isArray(tournamentsData) ? tournamentsData : tournamentsData?.tournaments ?? [];
  const pagination = tournamentsData?._pagination;
  const myTeam = myTeamData?.data ?? myTeamData;
  const myTournamentId = myTeam?.tournamentId?._id ?? myTeam?.tournamentId;
  const list = isManager
    ? allTournaments.filter((t) => myTournamentId && t._id === myTournamentId)
    : allTournaments;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Tournaments</h2>
        {!isManager && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {showForm ? 'Cancel' : 'Create'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && !isManager && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Create Tournament</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sport *</label>
              <div className="flex gap-2">
                {['cricket', 'football', 'badminton'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, sport: s, format: FORMATS_BY_SPORT[s][0] })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                      form.sport === s
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format *</label>
              <Select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                className="w-full"
              >
                {FORMATS_BY_SPORT[form.sport].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
              <input
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Teams</label>
              <input
                type="number"
                min={2}
                value={form.maxTeams}
                onChange={(e) => setForm({ ...form, maxTeams: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Tournament'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-400">Loading tournaments...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Name</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Sport</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Format</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Location</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((t) => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link to={`/tournaments/${t._id}`} className="text-emerald-600 hover:underline font-medium">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${SPORT_BADGE_COLORS[t.sport] || 'bg-gray-100 text-gray-700'}`}>
                      {t.sport ?? 'cricket'}
                    </span>
                  </td>
                  <td className="px-6 py-4 capitalize text-gray-600">{t.format}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-700'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{t.location || '—'}</td>
                  <td className="px-6 py-4">
                    {t.status === 'draft' && (
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-red-600 hover:text-red-700 text-xs font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No tournaments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <Pagination page={page} pages={pagination?.pages} total={pagination?.total} limit={10} onPageChange={setPage} />
      </div>
    </div>
  );
}
