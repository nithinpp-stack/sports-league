import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Select from '../../components/ui/Select';
import EditPlayerModal from '../../components/ui/EditPlayerModal';
import ViewPlayerModal from '../../components/ui/ViewPlayerModal';

export default function TournamentPlayers({ tournament, id }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [existingPlayerId, setExistingPlayerId] = useState('');
  // EditPlayerModal is self-contained — it seeds its own form state from the
  // player object we hand in. Keeping a single `editingPlayer` in parent state
  // is enough; the stale controlled-form props are gone.
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [viewingPlayerId, setViewingPlayerId] = useState(null);

  // All players in this tournament
  const { data: tournamentPlayersData } = useQuery({
    queryKey: ['tournament-players', id],
    queryFn: () => api.get(`/players?tournamentId=${id}`).then((r) => r.data),
    enabled: !!id,
  });
  const tournamentPlayers = Array.isArray(tournamentPlayersData)
    ? tournamentPlayersData
    : tournamentPlayersData?.players ?? [];

  // All players NOT in this tournament (for adding existing)
  const { data: allPlayersData } = useQuery({
    queryKey: ['all-players-no-tournament'],
    queryFn: () => api.get('/players?limit=100').then((r) => r.data),
    enabled: showAddPlayer,
  });
  const allPlayers = (Array.isArray(allPlayersData) ? allPlayersData : allPlayersData?.players ?? [])
    .filter((p) => !p.tournamentId || p.tournamentId !== id);

  // Player detail view queries
  const { data: viewingPlayerData } = useQuery({
    queryKey: ['player-detail', viewingPlayerId],
    queryFn: () => api.get(`/players/${viewingPlayerId}`).then((r) => r.data),
    enabled: !!viewingPlayerId,
  });
  const viewingPlayer = viewingPlayerData?.data?.player || viewingPlayerData?.player || viewingPlayerData;

  const { data: playerLiveStatsData } = useQuery({
    queryKey: ['player-live-stats', viewingPlayerId, id],
    queryFn: () => api.get(`/players/${viewingPlayerId}/stats?tournamentId=${id}`).then((r) => r.data),
    enabled: !!viewingPlayerId,
  });

  const { data: playerMatchesData } = useQuery({
    queryKey: ['player-matches', id],
    queryFn: () => api.get(`/matches?tournamentId=${id}`).then((r) => r.data),
    enabled: !!viewingPlayerId,
  });

  const addExistingPlayerMutation = useMutation({
    mutationFn: (playerId) => api.put(`/players/${playerId}`, { tournamentId: id, status: 'available' }),
    onSuccess: () => {
      toast.success('Player added to tournament!');
      qc.invalidateQueries(['tournament-players', id]);
      qc.invalidateQueries(['available-players', id]);
      setExistingPlayerId('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add player'),
  });

  // NB: the mutation lives inside EditPlayerModal now — parent just needs to
  // know when the modal closes, so cache invalidation happens in the modal.

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">
          Players ({tournamentPlayers.length})
        </h3>
        <div className="flex items-center gap-2">
          {/* "Create New" jumps to the global Players page — the canonical,
              sport-aware player-creation form (supports badminton shuttlers +
              event categories). Keeping a second, skeleton form in-tournament
              was a duplicate maintenance burden and didn't know about badminton. */}
          <button
            type="button"
            onClick={() => navigate('/players')}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            + Create New Player
          </button>
          <button
            onClick={() => setShowAddPlayer((v) => !v)}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            {showAddPlayer ? 'Cancel' : 'Add Existing'}
          </button>
        </div>
      </div>

      {showAddPlayer && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-center gap-3">
            <Select
              value={existingPlayerId}
              onChange={(e) => setExistingPlayerId(e.target.value)}
              className="flex-1"
              placeholder="Select a player..."
            >
              {allPlayers.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}{p.skill ? ` — ${p.skill.replace(/[-_]/g, ' ')}` : ''}{p.tournamentId ? ' (in another tournament)' : ''}
                </option>
              ))}
            </Select>
            <button
              disabled={!existingPlayerId || addExistingPlayerMutation.isPending}
              onClick={() => addExistingPlayerMutation.mutate(existingPlayerId)}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {addExistingPlayerMutation.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Need a fresh player? <button type="button" onClick={() => navigate('/players')} className="text-indigo-600 hover:underline font-medium">Create one on the Players page</button>, then add them here.
          </p>
        </div>
      )}

      {tournamentPlayers.length ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tournamentPlayers.map((p) => (
            <div key={p._id} className="rounded-lg border border-gray-100 bg-gray-50 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all" onClick={() => setViewingPlayerId(p._id)}>
              <div className="flex items-center gap-3 p-3">
                {p.photo ? (
                  <img src={`${import.meta.env.VITE_API_URL || ''}${p.photo}`} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-semibold">
                    {p.name?.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{p.skill?.replace(/[-_]/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      p.status === 'sold' ? 'bg-emerald-50 text-emerald-700' :
                      p.status === 'available' ? 'bg-gray-100 text-gray-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{p.status}</span>
                    {p.teamId?.name && <p className="text-[10px] text-gray-400 mt-0.5">{p.teamId.name}</p>}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPlayer(p);
                    }}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                    title="Edit"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Edit Player Modal */}
        {editingPlayer && (
          <EditPlayerModal
            player={editingPlayer}
            sport={tournament?.sport}
            tournamentId={id}
            onClose={() => setEditingPlayer(null)}
          />
        )}

        {/* Player Detail Modal */}
        {viewingPlayerId && viewingPlayer && (
          <ViewPlayerModal
            viewingPlayer={viewingPlayer}
            tournament={tournament}
            playerLiveStatsData={playerLiveStatsData}
            playerMatchesData={playerMatchesData}
            onClose={() => setViewingPlayerId(null)}
          />
        )}
        </>
      ) : (
        <p className="text-gray-400 text-sm">No players in this tournament yet.</p>
      )}
    </div>
  );
}
