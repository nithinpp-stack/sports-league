import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Select from '../../components/ui/Select';
import EditPlayerModal from '../../components/ui/EditPlayerModal';
import ViewPlayerModal from '../../components/ui/ViewPlayerModal';

export default function TournamentPlayers({ tournament, id }) {
  const qc = useQueryClient();

  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addPlayerMode, setAddPlayerMode] = useState('existing');
  const [existingPlayerId, setExistingPlayerId] = useState('');
  const [newPlayerForm, setNewPlayerForm] = useState({ name: '', skill: 'batsman', age: '', phone: '', address: '' });
  const [newPlayerPhoto, setNewPlayerPhoto] = useState(null);
  const [newPlayerPhotoPreview, setNewPlayerPhotoPreview] = useState(null);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editPlayerForm, setEditPlayerForm] = useState({});
  const [editPlayerPhoto, setEditPlayerPhoto] = useState(null);
  const [editPlayerPhotoPreview, setEditPlayerPhotoPreview] = useState(null);
  const [editPlayerCurrentPhoto, setEditPlayerCurrentPhoto] = useState(null);
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
    enabled: showAddPlayer && addPlayerMode === 'existing',
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

  const createNewPlayerMutation = useMutation({
    mutationFn: (data) => api.post('/players', { ...data, tournamentId: id, status: 'available' }),
    onSuccess: () => {
      toast.success('Player created and added!');
      qc.invalidateQueries(['tournament-players', id]);
      qc.invalidateQueries(['available-players', id]);
      setNewPlayerForm({ name: '', skill: 'batsman', age: '', phone: '', address: '' });
      setNewPlayerPhoto(null);
      setNewPlayerPhotoPreview(null);
      setShowAddPlayer(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create player'),
  });

  const updatePlayerMutation = useMutation({
    mutationFn: ({ playerId, data }) => api.put(`/players/${playerId}`, data),
    onSuccess: () => {
      toast.success('Player updated!');
      qc.invalidateQueries(['tournament-players', id]);
      setEditingPlayerId(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update player'),
  });

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">
          Players ({tournamentPlayers.length})
        </h3>
        <button
          onClick={() => setShowAddPlayer((v) => !v)}
          className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          {showAddPlayer ? 'Cancel' : 'Add Player'}
        </button>
      </div>

      {showAddPlayer && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddPlayerMode('existing')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                addPlayerMode === 'existing' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Select Existing
            </button>
            <button
              type="button"
              onClick={() => setAddPlayerMode('new')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                addPlayerMode === 'new' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Create New
            </button>
          </div>

          {addPlayerMode === 'existing' && (
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
          )}

          {addPlayerMode === 'new' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  placeholder="Name *"
                  value={newPlayerForm.name}
                  onChange={(e) => setNewPlayerForm({ ...newPlayerForm, name: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
                <Select
                  value={newPlayerForm.skill}
                  onChange={(e) => setNewPlayerForm({ ...newPlayerForm, skill: e.target.value })}
                >
                  <option value="batsman">Batsman</option>
                  <option value="bowler">Bowler</option>
                  <option value="allrounder">Allrounder</option>
                  <option value="wicketkeeper">Wicketkeeper</option>
                  <option value="goalkeeper">Goalkeeper</option>
                  <option value="defender">Defender</option>
                  <option value="midfielder">Midfielder</option>
                  <option value="forward">Forward</option>
                </Select>
                <input
                  placeholder="Age"
                  type="number"
                  min={10}
                  max={60}
                  value={newPlayerForm.age}
                  onChange={(e) => setNewPlayerForm({ ...newPlayerForm, age: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  placeholder="Phone"
                  value={newPlayerForm.phone}
                  onChange={(e) => setNewPlayerForm({ ...newPlayerForm, phone: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
                <input
                  placeholder="Address"
                  value={newPlayerForm.address}
                  onChange={(e) => setNewPlayerForm({ ...newPlayerForm, address: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setNewPlayerPhoto(file);
                        setNewPlayerPhotoPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {newPlayerPhotoPreview && (
                    <img src={newPlayerPhotoPreview} alt="Preview" className="mt-1 h-10 w-10 rounded-full object-cover border border-gray-200" />
                  )}
                </div>
              </div>
              <button
                disabled={!newPlayerForm.name || createNewPlayerMutation.isPending}
                onClick={async () => {
                  const payload = { ...newPlayerForm };
                  if (payload.age) payload.age = Number(payload.age);
                  else delete payload.age;
                  if (!payload.phone) delete payload.phone;
                  if (!payload.address) delete payload.address;
                  if (newPlayerPhoto) {
                    try {
                      const formData = new FormData();
                      formData.append('photo', newPlayerPhoto);
                      const uploadRes = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                      payload.photo = uploadRes.data?.url || uploadRes.data;
                    } catch { toast.error('Photo upload failed'); return; }
                  }
                  createNewPlayerMutation.mutate(payload);
                }}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {createNewPlayerMutation.isPending ? 'Creating...' : 'Create Player'}
              </button>
            </div>
          )}
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
                      setEditingPlayerId(p._id);
                      setEditPlayerForm({
                        name: p.name || '',
                        skill: p.skill || 'batsman',
                        age: p.age || '',
                        phone: p.phone || '',
                        address: p.address || '',
                      });
                      setEditPlayerCurrentPhoto(p.photo || null);
                      setEditPlayerPhoto(null);
                      setEditPlayerPhotoPreview(null);
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
        {editingPlayerId && (
          <EditPlayerModal
            editingPlayerId={editingPlayerId}
            editPlayerForm={editPlayerForm}
            setEditPlayerForm={setEditPlayerForm}
            editPlayerPhoto={editPlayerPhoto}
            setEditPlayerPhoto={setEditPlayerPhoto}
            editPlayerPhotoPreview={editPlayerPhotoPreview}
            setEditPlayerPhotoPreview={setEditPlayerPhotoPreview}
            editPlayerCurrentPhoto={editPlayerCurrentPhoto}
            updatePlayerMutation={updatePlayerMutation}
            onClose={() => setEditingPlayerId(null)}
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
