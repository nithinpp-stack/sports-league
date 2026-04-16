import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import Pagination from '../components/Pagination';
import Select from '../components/ui/Select';
import { useConfirm } from '../components/ui/ConfirmModal';

export default function ManagerListing() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [filterTournament, setFilterTournament] = useState('');

  const { data: managersData, isLoading } = useQuery({
    queryKey: ['all-managers', filterTournament, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterTournament) params.set('tournamentId', filterTournament);
      return api.get(`/managers?${params.toString()}`).then((r) => r.data);
    },
  });

  const { data: tournamentsData } = useQuery({
    queryKey: ['tournaments-for-filter'],
    queryFn: () => api.get('/tournaments').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/managers/${id}`),
    onSuccess: () => {
      toast.success('Manager deleted');
      qc.invalidateQueries(['all-managers']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const managers = Array.isArray(managersData) ? managersData : managersData?.managers ?? [];
  const pagination = managersData?._pagination;
  const tournaments = Array.isArray(tournamentsData) ? tournamentsData : tournamentsData?.tournaments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Managers</h2>
        <Select
          value={filterTournament}
          onChange={(e) => { setFilterTournament(e.target.value); setPage(1); }}
          placeholder="All Tournaments"
        >
          {tournaments.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading managers...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tournament</th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {managers.map((m) => (
                <tr key={m._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {m.name?.charAt(0) || '?'}
                      </div>
                      <span className="text-sm font-medium text-gray-800">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{m.email || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{m.phone || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                      {m.tournamentId?.name || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={async () => { if (await confirm(`Delete manager "${m.name}"?`, { variant: 'danger', confirmText: 'Delete' })) deleteMutation.mutate(m._id); }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!managers.length && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No managers found.</td></tr>
              )}
            </tbody>
          </table>
        )}
        {pagination && (
          <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
