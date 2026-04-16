import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Select from '../../components/ui/Select';
import { useConfirm } from '../../components/ui/ConfirmModal';
import EditTeamModal from '../../components/ui/EditTeamModal';
import EditManagerModal from '../../components/ui/EditManagerModal';
import EditPlayerModal from '../../components/ui/EditPlayerModal';
import ViewPlayerModal from '../../components/ui/ViewPlayerModal';

export default function TournamentTeams({ tournament, id }) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', totalPoints: 1000, managerId: '' });
  const [showNewMgr, setShowNewMgr] = useState(false);
  const [mgrForm, setMgrForm] = useState({ name: '', email: '', phone: '' });

  const [showAssignPlayer, setShowAssignPlayer] = useState(false);
  const [assignPlayerId, setAssignPlayerId] = useState('');
  const [assignTab, setAssignTab] = useState('existing');
  const [createAssignForm, setCreateAssignForm] = useState({ name: '', skill: 'batsman', age: '', phone: '' });

  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editTeamForm, setEditTeamForm] = useState({ name: '', totalPoints: 1000 });
  const [editingManager, setEditingManager] = useState(null);
  const [editManagerForm, setEditManagerForm] = useState({ name: '', email: '', phone: '' });
  const [viewingPlayerId, setViewingPlayerId] = useState(null);
  const [editingPlayerId, setEditingPlayerId] = useState(null);

  // Queries
  const { data: teamsData } = useQuery({
    queryKey: ['tournament-teams', id],
    queryFn: () => api.get(`/tournaments/${id}/teams`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: managersData } = useQuery({
    queryKey: ['managers', id],
    queryFn: () => api.get(`/managers?tournamentId=${id}`).then((r) => r.data),
  });
  const managersList = Array.isArray(managersData) ? managersData : managersData?.managers ?? [];

  const { data: teamPlayersData } = useQuery({
    queryKey: ['team-players', selectedTeamId],
    queryFn: () => api.get(`/teams/${selectedTeamId}/players`).then((r) => r.data),
    enabled: !!selectedTeamId,
  });

  const { data: availablePlayersData } = useQuery({
    queryKey: ['available-players', id],
    queryFn: () => api.get(`/players?tournamentId=${id}&status=available`).then((r) => r.data),
    enabled: !!id && showAssignPlayer,
  });
  const availablePlayers = Array.isArray(availablePlayersData)
    ? availablePlayersData
    : availablePlayersData?.players ?? [];

  // Derived data
  const teams = Array.isArray(teamsData) ? teamsData : teamsData?.teams ?? [];
  const teamPlayers = Array.isArray(teamPlayersData) ? teamPlayersData : teamPlayersData?.players ?? [];
  const selectedTeam = teams.find((t) => t._id === selectedTeamId);

  // Managers already assigned to a team in this tournament
  const assignedManagerIds = new Set(teams.map((t) => t.managerId?._id || t.managerId).filter(Boolean));
  const availableManagers = managersList.filter((m) => !assignedManagerIds.has(m._id));

  // Mutations
  const createTeamMutation = useMutation({
    mutationFn: (data) => api.post('/teams', data),
    onSuccess: () => {
      toast.success('Team created!');
      qc.invalidateQueries(['tournament-teams', id]);
      setTeamForm({ name: '', totalPoints: 1000, managerId: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create team'),
  });

  const createMgrMutation = useMutation({
    mutationFn: (data) => api.post('/managers', { ...data, tournamentId: id }),
    onSuccess: (res) => {
      const mgr = res.data?.manager || res.data;
      toast.success(`Manager "${mgr?.name}" created!`);
      qc.invalidateQueries(['managers', id]);
      setShowNewMgr(false);
      setMgrForm({ name: '', email: '', phone: '' });
      if (mgr?._id) setTeamForm((f) => ({ ...f, managerId: mgr._id }));
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create manager'),
  });

  const assignPlayerMutation = useMutation({
    mutationFn: ({ teamId, playerId }) => api.post(`/teams/${teamId}/assign-player`, { playerId }),
    onSuccess: () => {
      toast.success('Player assigned successfully!');
      qc.invalidateQueries(['team-players', selectedTeamId]);
      qc.invalidateQueries(['tournament-teams', id]);
      qc.invalidateQueries(['available-players', id]);
      setAssignPlayerId('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to assign player'),
  });

  const createAndAssignMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/players', { ...data, tournamentId: id, status: 'available', sport: tournament?.sport || 'cricket' });
      const player = res.data?.player || res.data?.data || res.data;
      await api.post(`/teams/${selectedTeamId}/assign-player`, { playerId: player._id });
      return player;
    },
    onSuccess: () => {
      toast.success('Player created and assigned to team!');
      qc.invalidateQueries(['team-players', selectedTeamId]);
      qc.invalidateQueries(['tournament-teams', id]);
      qc.invalidateQueries(['tournament-players', id]);
      qc.invalidateQueries(['available-players', id]);
      setCreateAssignForm({ name: '', skill: 'batsman', age: '', phone: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create player'),
  });

  const removePlayerMutation = useMutation({
    mutationFn: ({ teamId, playerId }) => api.post(`/teams/${teamId}/remove-player`, { playerId }),
    onSuccess: () => {
      toast.success('Player removed from team');
      qc.invalidateQueries(['team-players', selectedTeamId]);
      qc.invalidateQueries(['tournament-teams', id]);
      qc.invalidateQueries(['available-players', id]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to remove player'),
  });

  const handleTeamSubmit = (e) => {
    e.preventDefault();
    const payload = { name: teamForm.name, tournamentId: id, totalPoints: Number(teamForm.totalPoints) };
    if (teamForm.managerId) payload.managerId = teamForm.managerId;
    createTeamMutation.mutate(payload);
  };

  return (
    <>
      {/* New Team Form — separate card, always visible */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">New Team</h3>
        <form onSubmit={handleTeamSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Team Name *</label>
              <input
                type="text"
                required
                value={teamForm.name}
                onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Thunder Strikers"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Points Allocation</label>
              <input
                type="number"
                min={0}
                value={teamForm.totalPoints}
                onChange={(e) => setTeamForm((f) => ({ ...f, totalPoints: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Manager *</label>
              <div className="flex gap-1.5">
                <Select
                  required
                  value={teamForm.managerId}
                  onChange={(e) => setTeamForm((f) => ({ ...f, managerId: e.target.value }))}
                  className="flex-1"
                  placeholder="Select manager..."
                >
                  {availableManagers.map((m) => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => setShowNewMgr((v) => !v)}
                  className="px-2 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 whitespace-nowrap"
                >
                  {showNewMgr ? 'Cancel' : 'New'}
                </button>
              </div>
            </div>
          </div>
          {showNewMgr && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">Create New Manager</p>
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Name" value={mgrForm.name} onChange={(e) => setMgrForm({ ...mgrForm, name: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                <input placeholder="Email" type="email" value={mgrForm.email} onChange={(e) => setMgrForm({ ...mgrForm, email: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                <input placeholder="Phone" type="tel" value={mgrForm.phone} onChange={(e) => setMgrForm({ ...mgrForm, phone: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
              </div>
              <button
                type="button"
                disabled={!mgrForm.name || createMgrMutation.isPending}
                onClick={() => createMgrMutation.mutate(mgrForm)}
                className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded hover:bg-gray-800 disabled:opacity-50"
              >
                {createMgrMutation.isPending ? 'Creating...' : 'Create Manager'}
              </button>
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createTeamMutation.isPending}
              className="px-4 py-2 text-sm bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Teams</h3>
        </div>

        {teams.length ? (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              {teams.map((team) => {
                const isSelected = selectedTeamId === team._id;
                const totalPts = team.totalPoints ?? team.budget;
                return (
                  <div
                    key={team._id}
                    className={`relative flex-1 min-w-[180px] rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <button
                      className="w-full p-4 text-left"
                      onClick={() => { setSelectedTeamId(isSelected ? null : team._id); setShowAssignPlayer(false); setAssignPlayerId(''); }}
                    >
                      <p className={`font-semibold ${isSelected ? 'text-emerald-700' : 'text-gray-800'}`}>{team.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{team.playerCount ?? 0} players</span>
                        <span>{totalPts?.toLocaleString()} pts</span>
                      </div>
                      {team.managerId?.name && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                          </svg>
                          <span className="text-gray-600 font-medium truncate">{team.managerId.name}</span>
                        </div>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingTeamId(team._id); setEditTeamForm({ name: team.name, totalPoints: team.totalPoints ?? team.budget ?? 1000, managerId: team.managerId?._id || '' }); }}
                      className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="Edit team"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

          </>
        ) : (
          <p className="text-gray-400 text-sm">No teams yet. Add one above.</p>
        )}
      </div>

      {/* Team Details Card — Manager & Players */}
      {selectedTeamId && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">{selectedTeam?.name} — Details</h3>
          <div className="space-y-4">
            {/* Manager Section */}
            {selectedTeam?.managerId && (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Team Manager</h4>
                      </div>
                      <button
                        onClick={() => { setEditingManager(selectedTeam.managerId); setEditManagerForm({ name: selectedTeam.managerId.name || '', email: selectedTeam.managerId.email || '', phone: selectedTeam.managerId.phone || '' }); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Edit manager"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-emerald-600 flex items-center justify-center text-sm font-bold shadow-sm">
                        {selectedTeam.managerId.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{selectedTeam.managerId.name}</p>
                        {selectedTeam.managerId.email && <p className="text-xs text-gray-500">{selectedTeam.managerId.email}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Players Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      </svg>
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Players ({teamPlayers.length})
                      </h4>
                    </div>
                    <button
                      onClick={() => { setShowAssignPlayer((v) => !v); setAssignPlayerId(''); }}
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      {showAssignPlayer ? 'Cancel' : 'Add Player'}
                    </button>
                  </div>

                  {teamPlayers.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {teamPlayers.map((p) => (
                        <div key={p._id} className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group shadow-sm">
                          <div className="flex items-center gap-2">
                            {p.photo ? (
                              <img src={`${import.meta.env.VITE_API_URL || ''}${p.photo}`} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold shrink-0">
                                {p.name?.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                              <p className="text-[11px] text-gray-500 capitalize">{p.skill?.replace(/[-_]/g, ' ')}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => setViewingPlayerId(p._id)}
                                className="p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="View profile"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingPlayerId(p._id)}
                                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                                title="Edit player"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button
                                onClick={async () => { if (await confirm(`Remove ${p.name} from this team?`, { variant: 'danger', confirmText: 'Remove' })) removePlayerMutation.mutate({ teamId: selectedTeamId, playerId: p._id }); }}
                                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Remove from team"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No players in this team yet.</p>
                  )}

                  {showAssignPlayer && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      {/* Tabs */}
                      <div className="flex gap-1 mb-4 border-b border-gray-200">
                        <button
                          onClick={() => setAssignTab('existing')}
                          className={`pb-2 px-3 text-xs font-medium transition-colors ${assignTab === 'existing' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Assign Existing
                        </button>
                        <button
                          onClick={() => setAssignTab('create')}
                          className={`pb-2 px-3 text-xs font-medium transition-colors ${assignTab === 'create' ? 'text-emerald-600 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Create
                        </button>
                      </div>

                      {/* Assign Existing */}
                      {assignTab === 'existing' && (
                        <>
                          <div className="flex items-center gap-3">
                            <Select
                              value={assignPlayerId}
                              onChange={(e) => setAssignPlayerId(e.target.value)}
                              className="flex-1"
                              placeholder="Select available player..."
                            >
                              {availablePlayers.map((p) => (
                                <option key={p._id} value={p._id}>
                                  {p.name}{p.skill ? ` — ${p.skill.replace(/[-_]/g, ' ')}` : ''}
                                </option>
                              ))}
                            </Select>
                            <button
                              disabled={!assignPlayerId || assignPlayerMutation.isPending}
                              onClick={() => assignPlayerMutation.mutate({ teamId: selectedTeamId, playerId: assignPlayerId })}
                              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {assignPlayerMutation.isPending ? 'Assigning...' : 'Assign'}
                            </button>
                          </div>
                          {availablePlayers.length === 0 && (
                            <p className="text-xs text-gray-500 mt-2">No available players for this tournament.</p>
                          )}
                        </>
                      )}

                      {/* Create & Assign */}
                      {assignTab === 'create' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                              <input
                                value={createAssignForm.name}
                                onChange={(e) => setCreateAssignForm({ ...createAssignForm, name: e.target.value })}
                                placeholder="Player name"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
                              <Select
                                value={createAssignForm.skill}
                                onChange={(e) => setCreateAssignForm({ ...createAssignForm, skill: e.target.value })}
                                className="w-full"
                              >
                                {(tournament?.sport === 'football'
                                  ? ['goalkeeper', 'defender', 'midfielder', 'forward']
                                  : ['batsman', 'bowler', 'allrounder', 'wicketkeeper']
                                ).map((s) => (
                                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_]/g, ' ')}</option>
                                ))}
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                              <input
                                type="number"
                                value={createAssignForm.age}
                                onChange={(e) => setCreateAssignForm({ ...createAssignForm, age: e.target.value })}
                                placeholder="Age"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                              <input
                                value={createAssignForm.phone}
                                onChange={(e) => setCreateAssignForm({ ...createAssignForm, phone: e.target.value })}
                                placeholder="Phone number"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              disabled={!createAssignForm.name || createAndAssignMutation.isPending}
                              onClick={() => createAndAssignMutation.mutate(createAssignForm)}
                              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {createAndAssignMutation.isPending ? 'Creating...' : 'Create'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>{/* end Players section */}
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {editingTeamId && (
        <EditTeamModal
          team={teams.find((t) => t._id === editingTeamId)}
          managersList={managersList}
          onClose={() => setEditingTeamId(null)}
          tournamentId={id}
        />
      )}

      {/* Edit Manager Modal */}
      {editingManager && (
        <EditManagerModal
          manager={editingManager}
          onClose={() => setEditingManager(null)}
          tournamentId={id}
        />
      )}

      {/* Edit Player Modal */}
      {editingPlayerId && (
        <EditPlayerModal
          player={teamPlayers.find((p) => p._id === editingPlayerId)}
          sport={tournament?.sport || 'cricket'}
          onClose={() => setEditingPlayerId(null)}
          tournamentId={id}
          selectedTeamId={selectedTeamId}
        />
      )}

      {/* View Player Modal */}
      {viewingPlayerId && (
        <ViewPlayerModal
          playerId={viewingPlayerId}
          tournamentId={id}
          onClose={() => setViewingPlayerId(null)}
        />
      )}
    </>
  );
}
