import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { Users, Trophy } from '../components/ui/Icons';

export default function TeamProfile() {
  const { id } = useParams();

  const { data: team, isLoading: tLoading } = useQuery({
    queryKey: ['team', id],
    queryFn: () => api.get(`/teams/${id}`).then((r) => r.data.team || r.data),
  });

  const { data: playersData, isLoading: pLoading } = useQuery({
    queryKey: ['team-players', id],
    queryFn: () => api.get(`/teams/${id}/players`).then((r) => r.data),
    enabled: !!id,
  });

  const players = playersData?.players || [];

  if (tLoading) {
    return <Spinner size="lg" />;
  }

  if (!team) {
    return (
      <EmptyState
        icon={Users}
        title="Team not found"
        message="The team you are looking for does not exist or has been removed."
      />
    );
  }

  const totalPts = team.totalPoints ?? team.budget;
  const remainingPts = team.remainingPoints ?? team.remainingBudget;

  return (
    <div className="space-y-8">
      {/* Team info */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-5">{team.name}</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          {team.owner && (
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">
                Owner
              </p>
              <p className="text-slate-900 dark:text-white font-semibold">
                {team.owner?.name || team.owner}
              </p>
            </div>
          )}
          {team.tournamentId && (
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">
                Tournament
              </p>
              <Link
                to={`/tournaments/${team.tournamentId._id || team.tournamentId}`}
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
              >
                {team.tournamentId?.name || 'View tournament'}
              </Link>
            </div>
          )}
          {totalPts != null && (
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">
                Total Points
              </p>
              <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                {totalPts?.toLocaleString()} pts
              </p>
            </div>
          )}
          {remainingPts != null && (
            <div>
              <p className="text-sm text-slate-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">
                Remaining Points
              </p>
              <p className="text-slate-900 dark:text-white font-semibold">
                {remainingPts?.toLocaleString()} pts
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Players */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <Users size={20} className="text-slate-400 dark:text-gray-500" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Squad</h2>
          <div className="h-px flex-1 bg-slate-200 dark:bg-gray-700" />
          <span className="text-sm text-slate-500 dark:text-gray-400 font-medium">
            {players.length} players
          </span>
        </div>

        {pLoading ? (
          <Spinner size="md" />
        ) : players.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No players"
            message="No players have been added to this squad yet."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map((p) => {
              const player = p.player || p;
              return (
                <Link
                  key={player._id}
                  to={`/players/${player._id}`}
                  className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-xl p-4 transition-colors flex items-start gap-3"
                >
                  {player.photo ? (
                    <img
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${player.photo}`}
                      alt={player.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-gray-700 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-slate-100 dark:from-gray-700 dark:to-gray-800 border border-slate-200 dark:border-gray-700 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-emerald-500 dark:text-gray-400">
                        {player.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-slate-900 dark:text-white font-semibold truncate">
                      {player.name}
                    </p>
                    {player.skill && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium capitalize">
                        {player.skill}
                      </p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-slate-500 dark:text-gray-400">
                      {player.battingStyle && <span>{player.battingStyle}</span>}
                      {player.bowlingStyle && <span>{player.bowlingStyle}</span>}
                    </div>
                    {p.soldPrice != null && (
                      <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1.5 font-medium">
                        Bid: {p.soldPrice?.toLocaleString()} pts
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
