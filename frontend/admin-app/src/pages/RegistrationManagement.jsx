import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import api from '../services/api';
import Pagination from '../components/Pagination';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function RegistrationManagement() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: regsData, isLoading } = useQuery({
    queryKey: ['registrations', page],
    queryFn: () => api.get(`/registrations?page=${page}&limit=10`).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => api.put(`/registrations/${id}`, { status: 'approved' }),
    onSuccess: () => {
      toast.success('Registration approved!');
      qc.invalidateQueries(['registrations']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => api.put(`/registrations/${id}`, { status: 'rejected' }),
    onSuccess: () => {
      toast.success('Registration rejected.');
      qc.invalidateQueries(['registrations']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to reject'),
  });

  const registrations = Array.isArray(regsData) ? regsData : regsData?.registrations ?? [];
  const pagination = regsData?._pagination;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Registrations</h2>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-400">Loading registrations...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Player</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Skill</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Sport</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Age</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Tournament</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Status</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Applied</th>
                <th className="text-left px-6 py-3 text-gray-600 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registrations.map((r) => {
                const displayName = r.name || r.player?.name || r.playerName || '—';
                const photoUrl = r.photo ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${r.photo}` : null;
                return (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                            {displayName.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="font-medium text-gray-800">{displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 capitalize">{r.skill || '—'}</td>
                    <td className="px-6 py-4 text-gray-600 capitalize">{r.sport || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{r.age || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{r.tournament?.name ?? r.tournamentId?.name ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {r.createdAt ? dayjs(r.createdAt).format('MMM D, YYYY') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {r.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approveMutation.mutate(r._id)}
                            disabled={approveMutation.isPending}
                            className="px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate(r._id)}
                            disabled={rejectMutation.isPending}
                            className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!registrations.length && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400">No registrations found.</td>
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
