import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Select from './Select';

export default function EditTeamModal({ team, managersList, onClose, tournamentId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', totalPoints: 1000, managerId: '' });

  useEffect(() => {
    if (team) {
      setForm({
        name: team.name || '',
        totalPoints: team.totalPoints ?? 1000,
        managerId: team.managerId?._id || team.managerId || '',
      });
    }
  }, [team]);

  const mutation = useMutation({
    mutationFn: ({ teamId, data }) => api.put(`/teams/${teamId}`, data),
    onSuccess: () => {
      toast.success('Team updated!');
      qc.invalidateQueries(['tournament-teams', tournamentId]);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update team'),
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-[dialogIn_0.15s_ease-out]">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900">Edit Team</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Team name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points Allocation</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.totalPoints}
                onChange={(e) => setForm((f) => ({ ...f, totalPoints: e.target.value }))}
                placeholder="Points"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
              <Select
                value={form.managerId || ''}
                onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
                className="w-full"
                placeholder="Select manager..."
              >
                {managersList.map((m) => (
                  <option key={m._id} value={m._id}>{m.name} ({m.email})</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        <div className="flex border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate({ teamId: team._id, data: form })}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-3 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
