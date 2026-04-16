import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import EditManagerModal from '../../components/ui/EditManagerModal';

export default function TournamentManagers({ tournament, id }) {
  const qc = useQueryClient();

  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [editingManager, setEditingManager] = useState(null);
  const [editManagerForm, setEditManagerForm] = useState({ name: '', email: '', phone: '' });

  const { data: managersData } = useQuery({
    queryKey: ['managers', id],
    queryFn: () => api.get(`/managers?tournamentId=${id}`).then((r) => r.data),
  });
  const managersList = Array.isArray(managersData) ? managersData : managersData?.managers ?? [];

  const { data: teamsData } = useQuery({
    queryKey: ['tournament-teams', id],
    queryFn: () => api.get(`/tournaments/${id}/teams`).then((r) => r.data),
  });
  const teams = Array.isArray(teamsData) ? teamsData : teamsData?.teams ?? [];

  const createMgrMutation = useMutation({
    mutationFn: (data) => api.post('/managers', { ...data, tournamentId: id }),
    onSuccess: (res) => {
      const mgr = res.data?.manager || res.data;
      toast.success(`Manager "${mgr?.name}" created!`);
      qc.invalidateQueries(['managers', id]);
      setForm({ name: '', email: '', phone: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create manager'),
  });

  // Managers assigned to teams in this tournament
  const assignedManagers = teams
    .filter((t) => t.managerId)
    .map((t) => ({ ...t.managerId, teamName: t.name }));
  const assignedIds = new Set(assignedManagers.map((m) => m._id));
  // Unassigned managers (created but not linked to a team here)
  const unassignedManagers = managersList.filter((m) => !assignedIds.has(m._id));

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
      {/* Create new manager */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Create New Manager</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <input
            placeholder="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            disabled={!form.name || createMgrMutation.isPending}
            onClick={() => createMgrMutation.mutate(form)}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {createMgrMutation.isPending ? 'Creating...' : 'Create Manager'}
          </button>
        </div>
      </div>

      {/* Assigned Managers */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          Assigned to Teams ({assignedManagers.length})
        </h3>
        {assignedManagers.length > 0 ? (
          <div className="space-y-2">
            {assignedManagers.map((m, i) => (
              <div key={m._id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center text-xs font-bold">
                  {m.name?.charAt(0) || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{m.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{m.email || ''}</p>
                </div>
                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {m.teamName}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No managers assigned to teams yet.</p>
        )}
      </div>

      {/* Unassigned Managers */}
      {unassignedManagers.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">
            Available Managers ({unassignedManagers.length})
          </h3>
          <div className="space-y-2">
            {unassignedManagers.map((m) => (
              <div key={m._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <div className="w-9 h-9 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs font-bold">
                  {m.name?.charAt(0) || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700">{m.name}</p>
                  <p className="text-xs text-gray-400">{m.email}</p>
                </div>
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Not assigned
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingManager && (
        <EditManagerModal
          manager={editingManager}
          form={editManagerForm}
          setForm={setEditManagerForm}
          onClose={() => setEditingManager(null)}
          tournamentId={id}
        />
      )}
    </div>
  );
}
