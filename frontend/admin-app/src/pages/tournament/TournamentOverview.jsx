import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function TournamentOverview({ tournament, teams, matches, id }) {
  const { user } = useAuth();
  const [registered, setRegistered] = useState(false);

  const registerMutation = useMutation({
    mutationFn: () => api.post('/players/register-tournament', { tournamentId: id }),
    onSuccess: () => {
      toast.success('Registered successfully!');
      setRegistered(true);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Registration failed'),
  });

  const isPlayer = user?.role === 'player';
  const allowsRegistration = tournament?.status === 'registration';

  return (
    <div className="space-y-6">
      {/* Registration CTA */}
      {isPlayer && allowsRegistration && !registered && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Register for this Tournament</h3>
          <p className="text-sm text-blue-600 mb-4">
            This tournament is currently accepting player registrations.
          </p>
          <button
            onClick={() => registerMutation.mutate()}
            disabled={registerMutation.isPending}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {registerMutation.isPending ? 'Registering...' : 'Register Now'}
          </button>
        </div>
      )}

      {isPlayer && registered && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <p className="text-sm font-medium text-emerald-700">You have registered for this tournament.</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-gray-800">{teams?.length ?? 0}</p>
          <p className="text-xs font-medium text-gray-500 mt-1">Teams</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-gray-800">{matches?.length ?? 0}</p>
          <p className="text-xs font-medium text-gray-500 mt-1">Matches</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-gray-800 capitalize">
            {tournament?.format?.replace(/_/g, ' ') || '—'}
          </p>
          <p className="text-xs font-medium text-gray-500 mt-1">Format</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 text-center">
          <p className="text-2xl font-bold text-gray-800 capitalize">
            {tournament?.status || '—'}
          </p>
          <p className="text-xs font-medium text-gray-500 mt-1">Status</p>
        </div>
      </div>
    </div>
  );
}
