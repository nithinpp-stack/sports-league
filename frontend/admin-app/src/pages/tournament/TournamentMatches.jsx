import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Select from '../../components/ui/Select';
import { useConfirm } from '../../components/ui/ConfirmModal';

const STATUSES = ['draft', 'registration', 'active', 'completed'];

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  registration: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-purple-100 text-purple-700',
};

const MATCH_STATUS_COLORS = {
  upcoming: 'bg-blue-500/80 text-white',
  live: 'bg-red-500/80 text-white',
  completed: 'bg-emerald-500/80 text-white',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function TournamentMatches({ tournament, teams, id }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [selectedMatchIds, setSelectedMatchIds] = useState([]);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [matchForm, setMatchForm] = useState({ team1Id: '', team2Id: '', date: '', venue: '', totalOvers: 20 });
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generateFormat, setGenerateFormat] = useState('round_robin');
  const [generateVenue, setGenerateVenue] = useState('');
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [viewingScorecardMatchId, setViewingScorecardMatchId] = useState(null);

  const { data: matchesData, isLoading: mLoading } = useQuery({
    queryKey: ['tournament-matches', id],
    queryFn: () => api.get(`/tournaments/${id}/matches`).then((r) => r.data),
  });

  const { data: scorecardData } = useQuery({
    queryKey: ['scorecard', viewingScorecardMatchId],
    queryFn: () => api.get(`/livescores/${viewingScorecardMatchId}/scorecard`).then((r) => r.data),
    enabled: !!viewingScorecardMatchId,
    retry: false,
  });

  const createMatchMutation = useMutation({
    mutationFn: (data) => api.post('/matches', data),
    onSuccess: () => {
      toast.success('Match created!');
      qc.invalidateQueries(['tournament-matches', id]);
      setShowMatchForm(false);
      setMatchForm({ team1Id: '', team2Id: '', date: '', venue: '', totalOvers: 20 });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create match'),
  });

  const generateMutation = useMutation({
    mutationFn: (data) => api.post('/matches/generate', data),
    onSuccess: (res) => {
      const count = res.data?.count || res.data?.matches?.length || 0;
      toast.success(`${count} matches generated!`);
      qc.invalidateQueries(['tournament-matches', id]);
      setShowGenerateForm(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to generate matches'),
  });

  const updateMatchMutation = useMutation({
    mutationFn: ({ matchId, data }) => api.put(`/matches/${matchId}`, data),
    onSuccess: () => {
      toast.success('Match updated!');
      qc.invalidateQueries(['tournament-matches', id]);
      setEditingMatchId(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update match'),
  });

  const deleteMatchMutation = useMutation({
    mutationFn: (matchId) => api.delete(`/matches/${matchId}`),
    onSuccess: () => {
      toast.success('Match deleted!');
      qc.invalidateQueries(['tournament-matches', id]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete match'),
  });

  const matches = Array.isArray(matchesData) ? matchesData : matchesData?.matches ?? [];

  const bulkDeleteMatches = async () => {
    if (!selectedMatchIds.length) return;
    if (!(await confirm(`Delete ${selectedMatchIds.length} selected match(es)?`, { variant: 'danger', confirmText: 'Delete', description: 'This cannot be undone.' }))) return;
    try {
      await Promise.all(selectedMatchIds.map((mid) => api.delete(`/matches/${mid}`)));
      toast.success(`${selectedMatchIds.length} matches deleted!`);
      setSelectedMatchIds([]);
      qc.invalidateQueries(['tournament-matches', id]);
    } catch (err) {
      toast.error('Some matches failed to delete');
      qc.invalidateQueries(['tournament-matches', id]);
    }
  };

  const toggleMatchSelection = (matchId) => {
    setSelectedMatchIds((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
  };

  const toggleAllMatches = () => {
    if (selectedMatchIds.length === matches.length) {
      setSelectedMatchIds([]);
    } else {
      setSelectedMatchIds(matches.map((m) => m._id));
    }
  };

  const handleMatchSubmit = (e) => {
    e.preventDefault();
    if (matchForm.team1Id === matchForm.team2Id) {
      toast.error('Team 1 and Team 2 must be different');
      return;
    }
    createMatchMutation.mutate({
      tournamentId: id,
      team1Id: matchForm.team1Id,
      team2Id: matchForm.team2Id,
      date: matchForm.date,
      venue: matchForm.venue,
      totalOvers: Number(matchForm.totalOvers) || 20,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Matches</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowGenerateForm((prev) => !prev); setShowMatchForm(false); }}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showGenerateForm ? 'Cancel' : 'Generate Matches'}
          </button>
          <button
            onClick={() => { setShowMatchForm((prev) => !prev); setShowGenerateForm(false); }}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            {showMatchForm ? 'Cancel' : 'Add Match'}
          </button>
        </div>
      </div>

      {/* Generate Matches Form */}
      {showGenerateForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Auto-Generate Matches</h4>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Format</p>
              <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setGenerateFormat('round_robin')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    generateFormat === 'round_robin'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Round Robin
                </button>
                <button
                  type="button"
                  onClick={() => setGenerateFormat('knockout')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    generateFormat === 'knockout'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Knockout
                </button>
              </div>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Venue (optional)</label>
              <input
                type="text"
                value={generateVenue}
                onChange={(e) => setGenerateVenue(e.target.value)}
                placeholder="e.g. Main Stadium"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <button
              type="button"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate({ tournamentId: id, format: generateFormat, venue: generateVenue })}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {generateMutation.isPending ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {/* Add Match Form */}
      {showMatchForm && (
        <form onSubmit={handleMatchSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">New Match</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Team 1</label>
              <Select
                required
                value={matchForm.team1Id}
                onChange={(e) => setMatchForm((f) => ({ ...f, team1Id: e.target.value }))}
                className="w-full"
                placeholder="Select team..."
              >
                {teams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Team 2</label>
              <Select
                required
                value={matchForm.team2Id}
                onChange={(e) => setMatchForm((f) => ({ ...f, team2Id: e.target.value }))}
                className="w-full"
                placeholder="Select team..."
              >
                {teams
                  .filter((team) => team._id !== matchForm.team1Id)
                  .map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date &amp; Time</label>
              <input
                type="datetime-local"
                required
                value={matchForm.date}
                onChange={(e) => setMatchForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Venue (optional)</label>
              <input
                type="text"
                value={matchForm.venue}
                onChange={(e) => setMatchForm((f) => ({ ...f, venue: e.target.value }))}
                placeholder="e.g. Main Stadium"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Total Overs</label>
              <input
                type="number"
                min={1}
                max={50}
                value={matchForm.totalOvers}
                onChange={(e) => setMatchForm((f) => ({ ...f, totalOvers: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowMatchForm(false)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMatchMutation.isPending}
              className="px-4 py-2 text-sm bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              {createMatchMutation.isPending ? 'Creating...' : 'Create Match'}
            </button>
          </div>
        </form>
      )}

      {mLoading ? (
        <p className="text-gray-400 text-sm">Loading matches...</p>
      ) : matches.length ? (
        <>
          {matches.length > 1 && (
            <div className="flex items-center gap-3 mb-3">
              <label className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-[#f8f8f8] border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] cursor-pointer select-none hover:shadow-[0_2px_4px_rgba(0,0,0,0.08)] transition-shadow">
                <input
                  type="checkbox"
                  checked={selectedMatchIds.length === matches.length}
                  onChange={toggleAllMatches}
                  className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-gray-600">Select All</span>
              </label>
              {selectedMatchIds.length > 0 && (
                <button
                  onClick={bulkDeleteMatches}
                  className="px-3 py-2 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 border border-red-200 transition-colors"
                >
                  Delete Selected ({selectedMatchIds.length})
                </button>
              )}
            </div>
          )}
          <ul className="space-y-3">
          {matches.map((m) => (
            <li
              key={m._id}
              className={`rounded-lg overflow-hidden border cursor-pointer transition-colors ${
                selectedMatchIds.includes(m._id)
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
              onClick={(e) => {
                if (e.target.closest('input[type="checkbox"]') || e.target.closest('button') || e.target.closest('a')) return;
                navigate(`/matches/${m._id}/score`);
              }}
            >
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedMatchIds.includes(m._id)}
                    onChange={() => toggleMatchSelection(m._id)}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                  />
                  <span className="font-medium text-gray-800">
                    {m.team1Id?.name ?? 'TBD'} vs {m.team2Id?.name ?? 'TBD'}
                  </span>
                  <span
                    className={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${MATCH_STATUS_COLORS[m.status] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {m.status}
                  </span>
                  {m.venue && m.venue !== 'TBD' && (
                    <span className="ml-2 text-xs text-gray-400">{m.venue}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {m.status === 'upcoming' && (
                  <button
                    onClick={() => {
                      if (editingMatchId === m._id) {
                        setEditingMatchId(null);
                      } else {
                        setEditingMatchId(m._id);
                        setEditForm({
                          team1Id: m.team1Id?._id || m.team1Id || '',
                          team2Id: m.team2Id?._id || m.team2Id || '',
                          date: m.date ? new Date(m.date).toISOString().slice(0, 16) : '',
                          venue: m.venue || '',
                          status: m.status || 'upcoming',
                        });
                      }
                    }}
                    className="px-3 py-1 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg bg-[#f8f8f8] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08)] transition-shadow"
                  >
                    {editingMatchId === m._id ? 'Cancel' : 'Edit'}
                  </button>
                  )}
                  {m.status === 'upcoming' && (
                  <button
                    onClick={async () => {
                      const ok = await confirm(`Delete match "${m.team1Id?.name || 'TBD'} vs ${m.team2Id?.name || 'TBD'}"?`, { variant: 'danger', confirmText: 'Delete' });
                      if (ok) deleteMatchMutation.mutate(m._id);
                    }}
                    className="px-3 py-1 text-red-600 text-xs font-medium rounded-lg bg-red-50/50 border border-red-200 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08)] transition-shadow"
                  >
                    Delete
                  </button>
                  )}
                  {(m.status === 'completed' || m.status === 'live') && (
                    viewingScorecardMatchId === m._id ? (
                      <button
                        onClick={() => setViewingScorecardMatchId(null)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-700 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all"
                        title="Close scorecard"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => setViewingScorecardMatchId(m._id)}
                        className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 bg-[#f8f8f8] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08)] transition-shadow"
                      >
                        Scorecard
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Scorecard Expandable */}
              {viewingScorecardMatchId === m._id && (() => {
                const sc = scorecardData;
                const scMatch = sc?.match || sc;
                const scLive = sc?.liveScore || sc;
                const innings = scLive?.innings || [];

                if (!innings.length) {
                  return (
                    <div className="border-t border-gray-200 p-4 text-center text-sm text-gray-400">
                      No scorecard data available for this match.
                    </div>
                  );
                }

                return (
                  <div className="border-t border-gray-200 bg-white">
                    {/* Result banner */}
                    {m.result?.summary && (
                      <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 text-sm font-semibold text-emerald-700 text-center">
                        {m.result.summary}
                      </div>
                    )}

                    {innings.map((inn, innIdx) => {
                      const batTeamName = (() => {
                        const btid = inn.battingTeamId?._id || inn.battingTeamId;
                        if (String(btid) === String(m.team1Id?._id || m.team1Id)) return m.team1Id?.name || 'Team 1';
                        if (String(btid) === String(m.team2Id?._id || m.team2Id)) return m.team2Id?.name || 'Team 2';
                        return `Innings ${innIdx + 1}`;
                      })();
                      const overs = inn.totalOvers ?? 0;
                      const rr = overs > 0 ? (inn.totalRuns / overs).toFixed(2) : '0.00';
                      const extras = inn.extras || {};
                      const batted = (inn.batsmen || []).filter((b) => b.runs > 0 || b.balls > 0 || b.isOut);
                      const bowled = (inn.bowlers || []).filter((b) => b.overs > 0 || b.wickets > 0);

                      // Skip innings with no activity
                      if (batted.length === 0 && bowled.length === 0 && overs === 0 && (inn.totalRuns ?? 0) === 0) return null;

                      return (
                        <div key={innIdx} className={innIdx > 0 ? 'border-t-4 border-gray-200' : ''}>
                          {/* Innings Header */}
                          <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between">
                            <span className="font-bold text-sm">{batTeamName}</span>
                            <span className="font-extrabold text-lg">{inn.totalRuns ?? 0}/{inn.totalWickets ?? 0} <span className="text-gray-400 font-normal text-xs">({overs} ov, RR: {rr})</span></span>
                          </div>

                          {/* Batting */}
                          {batted.length > 0 && (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                                  <th className="px-3 py-2 text-left font-semibold">Batter</th>
                                  <th className="px-2 py-2 text-left font-semibold text-[10px]">Dismissal</th>
                                  <th className="px-2 py-2 text-center font-semibold">R</th>
                                  <th className="px-2 py-2 text-center font-semibold">B</th>
                                  <th className="px-2 py-2 text-center font-semibold">4s</th>
                                  <th className="px-2 py-2 text-center font-semibold">6s</th>
                                  <th className="px-2 py-2 text-center font-semibold">SR</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {batted.map((b, bi) => (
                                  <tr key={bi} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-1.5 font-medium text-gray-800">{b.playerId?.name || '—'}</td>
                                    <td className="px-2 py-1.5 text-[10px] text-gray-400">{b.isOut ? b.dismissalType || 'out' : <span className="text-emerald-500 font-medium">not out</span>}</td>
                                    <td className="px-2 py-1.5 text-center font-bold text-gray-900">{b.runs}</td>
                                    <td className="px-2 py-1.5 text-center text-gray-500">{b.balls}</td>
                                    <td className="px-2 py-1.5 text-center text-gray-500">{b.fours}</td>
                                    <td className="px-2 py-1.5 text-center text-gray-500">{b.sixes}</td>
                                    <td className="px-2 py-1.5 text-center text-gray-400">{b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {/* Extras + Total */}
                          <div className="px-3 py-1.5 border-t border-gray-100 flex justify-between text-[10px] text-gray-500">
                            <span>Extras: {extras.total || 0} (w{extras.wides || 0} nb{extras.noBalls || 0} b{extras.byes || 0} lb{extras.legByes || 0})</span>
                            <span className="font-bold text-gray-800">Total: {inn.totalRuns}/{inn.totalWickets} ({overs} ov)</span>
                          </div>

                          {/* Bowling */}
                          {bowled.length > 0 && (
                            <table className="w-full text-xs border-t border-gray-200">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                                  <th className="px-3 py-2 text-left font-semibold">Bowler</th>
                                  <th className="px-2 py-2 text-center font-semibold">O</th>
                                  <th className="px-2 py-2 text-center font-semibold">M</th>
                                  <th className="px-2 py-2 text-center font-semibold">R</th>
                                  <th className="px-2 py-2 text-center font-semibold">W</th>
                                  <th className="px-2 py-2 text-center font-semibold">Eco</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {bowled.map((b, bi) => (
                                  <tr key={bi} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-1.5 font-medium text-gray-800">{b.playerId?.name || '—'}</td>
                                    <td className="px-2 py-1.5 text-center text-gray-500">{typeof b.overs === 'number' ? parseFloat(b.overs.toFixed(1)) : b.overs}</td>
                                    <td className="px-2 py-1.5 text-center text-gray-500">{b.maidens}</td>
                                    <td className="px-2 py-1.5 text-center text-gray-500">{b.runs}</td>
                                    <td className="px-2 py-1.5 text-center font-bold text-emerald-600">{b.wickets}</td>
                                    <td className="px-2 py-1.5 text-center text-gray-400">{b.overs ? (b.runs / b.overs).toFixed(1) : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {/* Fall of Wickets */}
                          {inn.fallOfWickets?.length > 0 && (
                            <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] text-gray-400">
                              <span className="font-semibold text-gray-500">FOW: </span>
                              {inn.fallOfWickets.map((f, fi) => (
                                <span key={fi}>{fi > 0 && ' | '}{f.runs}-{f.wicketNumber} ({f.playerId?.name || '?'}, {typeof f.overs === 'number' ? parseFloat(f.overs.toFixed(1)) : f.overs} ov)</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {editingMatchId === m._id && (
                <div className="border-t border-gray-200 p-4 bg-white space-y-3">
                  <h5 className="text-xs font-semibold text-gray-600 uppercase">Edit Match</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Team 1</label>
                      <Select
                        value={editForm.team1Id}
                        onChange={(e) => setEditForm((f) => ({ ...f, team1Id: e.target.value }))}
                        className="w-full"
                        placeholder="Select team..."
                      >
                        {teams.map((team) => (
                          <option key={team._id} value={team._id}>{team.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Team 2</label>
                      <Select
                        value={editForm.team2Id}
                        onChange={(e) => setEditForm((f) => ({ ...f, team2Id: e.target.value }))}
                        className="w-full"
                        placeholder="Select team..."
                      >
                        {teams
                          .filter((team) => team._id !== editForm.team1Id)
                          .map((team) => (
                            <option key={team._id} value={team._id}>{team.name}</option>
                          ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Date &amp; Time</label>
                      <input
                        type="datetime-local"
                        value={editForm.date}
                        onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Venue</label>
                      <input
                        type="text"
                        value={editForm.venue}
                        onChange={(e) => setEditForm((f) => ({ ...f, venue: e.target.value }))}
                        placeholder="e.g. Main Stadium"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <Select
                        value={editForm.status}
                        onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full"
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="live">Live</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingMatchId(null)}
                      className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={updateMatchMutation.isPending}
                      onClick={() => updateMatchMutation.mutate({ matchId: m._id, data: editForm })}
                      className="px-4 py-2 text-sm bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-60"
                    >
                      {updateMatchMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        </>
      ) : (
        <p className="text-gray-400 text-sm">No matches scheduled yet.</p>
      )}
    </div>
  );
}
