import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import Pagination from '../components/Pagination';
import Select from '../components/ui/Select';
import { useConfirm } from '../components/ui/ConfirmModal';

export default function TeamManagement() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  // Login credentials for the team manager. Collected alongside the team so
  // the admin can hand the login info to the team owner in one step.
  const [form, setForm] = useState({
    name: '',
    tournamentId: '',
    totalPoints: 1000,
    managerName: '',
    managerEmail: '',
    managerPassword: '',
    managerPhone: '',
  });

  const { data: teamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams', page],
    queryFn: () => api.get(`/teams?page=${page}&limit=10`).then((r) => r.data),
  });

  const { data: tournamentsData } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => api.get('/tournaments').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      // Shape the flat form into the backend payload: team fields at the top,
      // login fields nested under `managerAccount` so the controller can
      // create a User + wire managerId atomically.
      const payload = {
        name: data.name,
        tournamentId: data.tournamentId,
        totalPoints: Number(data.totalPoints) || 0,
        managerAccount: {
          name: data.managerName,
          email: data.managerEmail,
          password: data.managerPassword,
          phone: data.managerPhone || undefined,
        },
      };
      return api.post('/teams', payload);
    },
    onSuccess: (res) => {
      const login = res.data?.managerLogin;
      toast.success(
        login?.email
          ? `Team created — login: ${login.email}`
          : 'Team created!',
        { duration: 5000 }
      );
      qc.invalidateQueries(['teams']);
      setShowForm(false);
      setForm({
        name: '',
        tournamentId: '',
        totalPoints: 1000,
        managerName: '',
        managerEmail: '',
        managerPassword: '',
        managerPhone: '',
      });
      setPage(1);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create team'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/teams/${id}`),
    onSuccess: () => {
      toast.success('Team deleted!');
      qc.invalidateQueries(['teams']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete team'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const handleDelete = async (t) => {
    if (!await confirm(`Delete team "${t.name}"?`, { message: 'This cannot be undone.', variant: 'danger', confirmText: 'Delete' })) return;
    deleteMutation.mutate(t._id);
  };

  const teams = Array.isArray(teamsData) ? teamsData : teamsData?.teams ?? [];
  const teamsPagination = teamsData?._pagination;
  const tournaments = Array.isArray(tournamentsData) ? tournamentsData : tournamentsData?.tournaments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Teams</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Create'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Create Team</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tournament *</label>
              <Select
                required
                value={form.tournamentId}
                onChange={(e) => setForm({ ...form, tournamentId: e.target.value })}
                className="w-full"
                placeholder="Select tournament..."
              >
                {tournaments.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points Allocation</label>
              <input
                type="number"
                min={0}
                value={form.totalPoints}
                onChange={(e) => setForm({ ...form, totalPoints: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-3">
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Team Login Credentials</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    These credentials are for the team manager to log into the admin panel and bid.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Manager Name *</label>
                    <input
                      required
                      placeholder="e.g. Mumbai Team Owner"
                      value={form.managerName}
                      onChange={(e) => setForm({ ...form, managerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone (optional)</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      value={form.managerPhone}
                      onChange={(e) => setForm({ ...form, managerPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Login Email *</label>
                    <input
                      required
                      type="email"
                      placeholder="mumbai@bid.test"
                      value={form.managerEmail}
                      onChange={(e) => setForm({ ...form, managerEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                    <input
                      required
                      type="text"
                      minLength={6}
                      placeholder="min 6 chars"
                      value={form.managerPassword}
                      onChange={(e) => setForm({ ...form, managerPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500">
                  Share these credentials with the team. They log in at the admin panel and land directly on their auction bidding page.
                </p>
              </div>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {teamsLoading ? (
          <p className="p-6 text-gray-400">Loading teams...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Name</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Tournament</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Manager</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Points</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Players</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teams.map((t) => {
                const totalPts = t.totalPoints ?? t.budget;
                const remainingPts = t.remainingPoints ?? t.remainingBudget;
                return (
                  <tr key={t._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">{t.name}</td>
                    <td className="px-6 py-4 text-gray-600">{t.tournamentId?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{t.managerId?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {remainingPts != null
                        ? `${remainingPts?.toLocaleString()} / ${totalPts?.toLocaleString()} pts`
                        : totalPts != null
                        ? `${totalPts?.toLocaleString()} pts`
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{t.playerCount ?? 0}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-red-600 hover:text-red-700 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!teams.length && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">No teams found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <Pagination page={page} pages={teamsPagination?.pages} total={teamsPagination?.total} limit={10} onPageChange={setPage} />
      </div>
    </div>
  );
}
