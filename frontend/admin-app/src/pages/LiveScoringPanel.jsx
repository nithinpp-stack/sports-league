import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import Select from '../components/ui/Select';
import { useConfirm } from '../components/ui/ConfirmModal';

const EXTRA_TYPES = ['none', 'wide', 'no_ball', 'bye', 'leg_bye'];
const WICKET_TYPES = ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket'];

/* ─── helper: ball dot color ─── */
function ballDotStyle(ball) {
  if (ball.isWicket) return 'bg-red-500 text-white';
  if (ball.extraType === 'wide' || ball.extraType === 'no_ball') return 'bg-amber-400 text-white';
  if (ball.runs === 0) return 'bg-gray-200 text-gray-500';
  if (ball.runs === 4) return 'bg-blue-500 text-white';
  if (ball.runs === 6) return 'bg-purple-500 text-white';
  return 'bg-white text-gray-800 ring-1 ring-gray-200';
}
function ballDotLabel(ball) {
  if (ball.isWicket) return 'W';
  if (ball.extraType === 'wide') return 'Wd';
  if (ball.extraType === 'no_ball') return 'Nb';
  return String(ball.runs);
}

export default function LiveScoringPanel() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();

  /* ─── State ─── */
  const [battingTeamId, setBattingTeamId] = useState('');
  const [bowlingTeamId, setBowlingTeamId] = useState('');
  const [teamsLocked, setTeamsLocked] = useState(false);
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  const [runs, setRuns] = useState(0);
  const [extras, setExtras] = useState('none');
  const [isWicket, setIsWicket] = useState(false);
  const [wicketType, setWicketType] = useState('bowled');
  const [endMatchForm, setEndMatchForm] = useState({ winner: '', winType: 'runs', winMargin: '', summary: '', manOfMatch: '', bestBatsman: '', bestBowler: '' });
  const [showEndMatch, setShowEndMatch] = useState(false);

  /* ─── Queries ─── */
  const { data: matchData, isLoading: matchLoading } = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => api.get(`/matches/${matchId}`).then(r => r.data),
  });
  const { data: liveScore } = useQuery({
    queryKey: ['livescore', matchId],
    queryFn: async () => {
      try {
        const response = await api.get(`/livescores/${matchId}`);
        // Handle both { data: liveScore } and { success, data: { data: liveScore } } formats
        const data = response.data.data || response.data;
        return data;
      } catch (err) {
        if (err.response?.status === 404) return null;
        throw err;
      }
    },
    retry: false,
  });

  const match = matchData?.match ?? matchData;
  const ls = liveScore;
  const sport = match?.tournamentId?.sport || 'cricket';
  const team1 = match?.team1Id;
  const team2 = match?.team2Id;

  const { data: team1PlayersData } = useQuery({
    queryKey: ['team-players', team1?._id],
    queryFn: () => api.get(`/teams/${team1._id}/players`).then(r => r.data),
    enabled: !!team1?._id,
  });
  const { data: team2PlayersData } = useQuery({
    queryKey: ['team-players', team2?._id],
    queryFn: () => api.get(`/teams/${team2._id}/players`).then(r => r.data),
    enabled: !!team2?._id,
  });

  const team1Players = Array.isArray(team1PlayersData) ? team1PlayersData : team1PlayersData?.players ?? [];
  const team2Players = Array.isArray(team2PlayersData) ? team2PlayersData : team2PlayersData?.players ?? [];
  const battingPlayers = battingTeamId === team1?._id ? team1Players : battingTeamId === team2?._id ? team2Players : [];
  const bowlingPlayers = bowlingTeamId === team1?._id ? team1Players : bowlingTeamId === team2?._id ? team2Players : [];

  /* ─── Auto-set teams from live score & lock ─── */
  useEffect(() => {
    if (ls) {
      const batId = ls.battingTeamId?._id || ls.battingTeamId;
      const bowlId = ls.bowlingTeamId?._id || ls.bowlingTeamId;
      if (batId && !battingTeamId) setBattingTeamId(String(batId));
      if (bowlId && !bowlingTeamId) setBowlingTeamId(String(bowlId));
      if (batId && bowlId) setTeamsLocked(true);
    }
  }, [ls]);

  useEffect(() => {
    if (battingTeamId && !bowlingTeamId && team1?._id && team2?._id) {
      setBowlingTeamId(battingTeamId === team1._id ? team2._id : team1._id);
    }
  }, [battingTeamId, team1?._id, team2?._id]);

  useEffect(() => {
    if (battingTeamId && bowlingTeamId && !teamsLocked && ls) setTeamsLocked(true);
  }, [battingTeamId, bowlingTeamId, ls]);

  const currentInnings = ls?.innings?.[(ls?.currentInnings ?? 1) - 1];
  const outPlayerIds = new Set(
    (currentInnings?.batsmen || [])
      .filter(b => b.isOut)
      .map(b => String(b.playerId?._id || b.playerId))
  );

  // Clear dismissed batsmen from striker/non-striker slots
  useEffect(() => {
    if (outPlayerIds.size === 0) return;
    if (strikerId && outPlayerIds.has(strikerId)) setStrikerId('');
    if (nonStrikerId && outPlayerIds.has(nonStrikerId)) setNonStrikerId('');
  }, [currentInnings?.batsmen]);
  const totalOvers = match?.totalOvers ?? 20;
  const oversCompleted = ls?.currentOver ?? 0;
  const ballsInOver = ls?.currentBall ?? 0;
  const oversLimitReached = oversCompleted >= totalOvers;

  const battingTeamName = battingTeamId === team1?._id ? team1?.name : battingTeamId === team2?._id ? team2?.name : '—';
  const bowlingTeamName = bowlingTeamId === team1?._id ? team1?.name : bowlingTeamId === team2?._id ? team2?.name : '—';

  const getTeamName = (teamId) => {
    if (!teamId) return '—';
    const id = typeof teamId === 'object' ? teamId._id : String(teamId);
    if (id === team1?._id) return team1?.name;
    if (id === team2?._id) return team2?.name;
    return '—';
  };

  const thisOverBalls = useMemo(() => {
    if (!currentInnings?.overs?.length) return [];
    const overNum = ballsInOver === 0 && oversCompleted > 0 ? oversCompleted : oversCompleted + 1;
    const overData = currentInnings.overs.find(o => o.overNumber === overNum);
    return overData?.balls || [];
  }, [currentInnings, oversCompleted, ballsInOver]);

  const getPlayerBatStats = (playerId) => {
    if (!playerId || !currentInnings?.batsmen) return null;
    return currentInnings.batsmen.find(b => String(b.playerId?._id || b.playerId) === String(playerId));
  };
  const getPlayerBowlStats = (playerId) => {
    if (!playerId || !currentInnings?.bowlers) return null;
    return currentInnings.bowlers.find(b => String(b.playerId?._id || b.playerId) === String(playerId));
  };

  const target = useMemo(() => {
    if (!ls || (ls.currentInnings ?? 1) < 2 || !ls.innings?.[0]) return null;
    const firstInningsRuns = ls.innings[0].totalRuns ?? 0;
    const targetRuns = firstInningsRuns + 1;
    const currentRuns = currentInnings?.totalRuns ?? 0;
    const remaining = targetRuns - currentRuns;
    const oversLeft = totalOvers - oversCompleted - ballsInOver / 6;
    const reqRate = oversLeft > 0 ? (remaining / oversLeft).toFixed(2) : '—';
    return { targetRuns, remaining, reqRate };
  }, [ls, currentInnings, totalOvers, oversCompleted, ballsInOver]);

  /* ─── Mutations ─── */
  const startMutation = useMutation({
    mutationFn: () => api.post(`/livescores/${matchId}/start`, { battingTeamId, bowlingTeamId }),
    onSuccess: () => { toast.success('Match started!'); qc.invalidateQueries(['livescore', matchId]); qc.invalidateQueries(['match', matchId]); setTeamsLocked(true); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const ballMutation = useMutation({
    mutationFn: (data) => api.post(`/livescores/${matchId}/ball`, data),
    onSuccess: (_, variables) => {
      toast.success('Ball recorded');
      qc.invalidateQueries(['livescore', matchId]);
      const runsScored = variables.runs ?? 0;
      const extraType = variables.extras?.type;
      const isWide = extraType === 'wide';
      const isNoBall = extraType === 'no_ball';
      const wasWicket = variables.isWicket;
      // Clear out batter on wicket
      if (wasWicket) {
        setStrikerId('');
      } else if (!isWide && !isNoBall && runsScored % 2 === 1) {
        // Odd runs on a legal delivery — swap strike
        setStrikerId(nonStrikerId);
        setNonStrikerId(strikerId);
      }
      setRuns(0); setExtras('none'); setIsWicket(false); setWicketType('bowled');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const undoMutation = useMutation({
    mutationFn: () => api.post(`/livescores/${matchId}/undo`),
    onSuccess: (data) => {
      toast.success('Last ball undone');
      qc.invalidateQueries(['livescore', matchId]);
      const undoneBall = data?.undoneBall;
      if (undoneBall) {
        if (undoneBall.batsmanId) setStrikerId(String(undoneBall.batsmanId));
        if (undoneBall.bowlerId) setBowlerId(String(undoneBall.bowlerId));
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const endInningsMutation = useMutation({
    mutationFn: () => api.post(`/livescores/${matchId}/end-innings`, { nextBattingTeamId: bowlingTeamId, nextBowlingTeamId: battingTeamId }),
    onSuccess: () => {
      toast.success('Innings ended — teams swapped');
      qc.invalidateQueries(['livescore', matchId]);
      const prevBat = battingTeamId, prevBowl = bowlingTeamId;
      setBattingTeamId(prevBowl); setBowlingTeamId(prevBat);
      setStrikerId(''); setNonStrikerId(''); setBowlerId('');
      setTeamsLocked(true);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const endMatchMutation = useMutation({
    mutationFn: (data) => api.post(`/livescores/${matchId}/end-match`, data),
    onSuccess: () => { toast.success('Match ended'); qc.invalidateQueries(['livescore', matchId]); qc.invalidateQueries(['match', matchId]); setShowEndMatch(false); navigate(-1); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const reopenMatchMutation = useMutation({
    mutationFn: () => api.post(`/livescores/${matchId}/reopen`),
    onSuccess: () => {
      toast.success('Match reopened for editing');
      qc.invalidateQueries(['match', matchId]);
      qc.invalidateQueries(['livescore', matchId]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to reopen match'),
  });

  const isCompleted = match?.status === 'completed';

  const handleRecordBall = (e) => {
    e.preventDefault();
    if (!strikerId) { toast.error('Select striker'); return; }
    if (!bowlerId) { toast.error('Select bowler'); return; }
    if (strikerId === nonStrikerId) { toast.error('Striker and non-striker must be different'); return; }
    ballMutation.mutate({
      batsmanId: strikerId, bowlerId,
      runs: Number(runs),
      extras: extras === 'none' ? undefined : { type: extras, runs: 1 },
      isWicket, wicket: isWicket ? { type: wicketType } : undefined,
    });
  };

  if (matchLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full" /></div>;

  /* ════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════ */
  return (
    <div className="flex gap-7 max-w-[1480px] mx-auto items-start">
      {/* ─── LEFT COLUMN ─── */}
      <div className="flex-1 space-y-5 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{isCompleted ? 'Match Review' : 'Live Scoring'}</h2>
            <p className="text-sm text-gray-400 mt-1">{isCompleted ? 'View scorecard and reopen for corrections' : 'Ball-by-ball match control'}</p>
          </div>
          <Link to={`/tournaments/${match?.tournamentId?._id || match?.tournamentId}`}
            className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Tournament
          </Link>
        </div>

        {/* Completed Match Banner */}
        {isCompleted && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">This match has ended</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {sport === 'badminton'
                    ? 'Reopen the match to make corrections to game scores or points.'
                    : sport === 'football'
                    ? 'Reopen the match to make corrections to goals or cards.'
                    : 'Reopen the match to make corrections to scores, balls, or wickets.'}
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                if (await confirm('Reopen this match?', { message: 'The match will be set back to live status. You can make corrections and end it again.', confirmText: 'Reopen Match' }))
                  reopenMatchMutation.mutate();
              }}
              disabled={reopenMatchMutation.isPending}
              className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition-colors shadow-sm disabled:opacity-50 shrink-0"
            >
              {reopenMatchMutation.isPending ? 'Reopening...' : 'Reopen Match'}
            </button>
          </div>
        )}

        {/* Match Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <span className="font-bold text-gray-900 text-2xl tracking-tight">{team1?.name ?? 'Team 1'}</span>
              <span className="text-2xl font-black text-gray-200 tracking-tight">VS</span>
              <span className="font-bold text-gray-900 text-2xl tracking-tight">{team2?.name ?? 'Team 2'}</span>
            </div>
            <span className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
              match?.status === 'live' ? 'bg-red-50 text-red-600 ring-1 ring-red-100' :
              match?.status === 'completed' ? 'bg-gray-100 text-gray-500' :
              'bg-blue-50 text-blue-600 ring-1 ring-blue-100'
            }`}>
              {match?.status === 'live' && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 animate-pulse align-middle" />}
              {match?.status}
            </span>
          </div>
        </div>

        {sport === 'cricket' && (
          <>
            {/* ─── Team Selection ─── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {teamsLocked ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
                    {/* Batting Team */}
                    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
                          <rect x="8" y="50" width="6" height="12" rx="2" transform="rotate(-45 8 50)" fill="white"/>
                          <rect x="16" y="42" width="6" height="32" rx="2" transform="rotate(-45 16 42)" fill="white"/>
                          <ellipse cx="42" cy="16" rx="4" ry="3" transform="rotate(-45 42 16)" fill="white" opacity="0.6"/>
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Batting</span>
                        <span className="block text-base font-bold text-emerald-800 truncate">{battingTeamName}</span>
                      </div>
                    </div>
                    {/* Bowling Team */}
                    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0 shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
                          <circle cx="32" cy="32" r="18" fill="white"/>
                          <path d="M26 16 C30 28, 34 36, 26 48" stroke="#3b82f6" strokeWidth="2.5" fill="none"/>
                          <path d="M38 16 C34 28, 30 36, 38 48" stroke="#3b82f6" strokeWidth="2.5" fill="none"/>
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <span className="block text-[10px] font-semibold text-blue-500 uppercase tracking-wider">Bowling</span>
                        <span className="block text-base font-bold text-blue-800 truncate">{bowlingTeamName}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setTeamsLocked(false)}
                    className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all" title="Change teams">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">Team Selection</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Batting Team</label>
                      <div className="flex gap-2.5">
                        {[team1, team2].filter(Boolean).map((t) => (
                          <button key={t._id} type="button"
                            onClick={() => { setBattingTeamId(t._id); if (bowlingTeamId === t._id) setBowlingTeamId(''); }}
                            className={`flex-1 py-3 px-3 rounded-xl text-sm font-bold border-2 transition-all text-center leading-tight ${
                              battingTeamId === t._id
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}>{t.name}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-2">Bowling Team</label>
                      <div className="flex gap-2.5">
                        {[team1, team2].filter(Boolean).map((t) => (
                          <button key={t._id} type="button"
                            onClick={() => { setBowlingTeamId(t._id); if (battingTeamId === t._id) setBattingTeamId(''); }}
                            disabled={t._id === battingTeamId}
                            className={`flex-1 py-3 px-3 rounded-xl text-sm font-bold border-2 transition-all text-center leading-tight ${
                              bowlingTeamId === t._id
                                ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                                : t._id === battingTeamId
                                ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}>{t.name}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {battingTeamId && bowlingTeamId && (
                    <div className="flex justify-end mt-4">
                      <button onClick={() => setTeamsLocked(true)}
                        className="px-5 py-2.5 text-sm text-gray-700 font-medium flex items-center gap-2 transition-all bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-full hover:bg-white hover:border-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        Lock selection
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Start Match */}
            {!ls && match?.status === 'upcoming' && battingTeamId && bowlingTeamId && (
              <div className="flex justify-center py-3">
                <button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}
                  className="px-12 py-4 bg-gray-900 text-white font-extrabold rounded-2xl hover:bg-gray-800 transition-all disabled:opacity-50 text-lg shadow-lg hover:shadow-xl active:scale-[0.98]">
                  {startMutation.isPending ? 'Starting...' : 'Start Match'}
                </button>
              </div>
            )}

            {/* Total Overs */}
            {ls && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Overs</span>
                  <span className="text-2xl font-black text-gray-900">{totalOvers}</span>
                </div>
                {(ls.currentInnings ?? 1) <= 1 ? (
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} max={50} defaultValue={totalOvers}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-base text-center font-bold focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val > 0 && val <= 50 && val !== match?.totalOvers) {
                          api.put(`/matches/${matchId}`, { totalOvers: val })
                            .then(() => { toast.success(`Overs set to ${val}`); qc.invalidateQueries(['match', matchId]); })
                            .catch((err) => toast.error(err.response?.data?.message || 'Failed'));
                        }
                      }} />
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic flex items-center gap-1.5 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    Locked after 1st innings
                  </span>
                )}
              </div>
            )}

            {/* ─── SCOREBOARD ─── */}
            {ls && (
              <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-8">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500 font-extrabold uppercase tracking-[0.2em]">
                        {battingTeamName} — Innings {ls.currentInnings ?? 1}
                      </p>
                      <div className="flex items-end gap-4 mt-3">
                        <span className="text-8xl font-black text-white tracking-tighter leading-none">
                          {currentInnings?.totalRuns ?? 0}<span className="text-gray-600">/</span><span className="text-gray-400">{currentInnings?.totalWickets ?? 0}</span>
                        </span>
                        <span className="text-xl text-gray-500 pb-3 font-semibold">
                          ({oversCompleted}.{ballsInOver}/{totalOvers} ov)
                        </span>
                      </div>
                      {oversLimitReached && (
                        <p className="mt-3 text-amber-400 text-sm font-bold flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          Over limit — end innings or increase overs
                        </p>
                      )}
                    </div>
                    <div className="text-right space-y-2">
                      <div>
                        <p className="text-xs text-gray-600 uppercase tracking-widest font-bold">Run Rate</p>
                        <p className="text-4xl font-black text-emerald-400 mt-1">
                          {oversCompleted > 0 ? ((currentInnings?.totalRuns || 0) / (oversCompleted + ballsInOver / 6)).toFixed(2) : '0.00'}
                        </p>
                      </div>
                      {target && (
                        <div className="mt-3 pt-3 border-t border-gray-700/50">
                          <p className="text-xs text-gray-600 uppercase tracking-widest font-bold">Target {target.targetRuns}</p>
                          <p className="text-xl font-extrabold text-amber-400 mt-1">
                            Need {target.remaining > 0 ? target.remaining : 0} <span className="text-sm text-gray-500 font-bold">RRR {target.reqRate}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* This Over Bar */}
                {thisOverBalls.length > 0 && (
                  <div className="px-8 pb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-extrabold uppercase tracking-widest shrink-0">This Over</span>
                      <div className="flex gap-2">
                        {thisOverBalls.map((b, i) => (
                          <span key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${ballDotStyle(b)}`}>
                            {ballDotLabel(b)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── AT THE CREASE ─── */}
            {ls && (strikerId || nonStrikerId || bowlerId) && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: strikerId, label: 'Striker', color: 'emerald', isBat: true },
                  { id: nonStrikerId, label: 'Non-Striker', color: 'gray', isBat: true },
                  { id: bowlerId, label: 'Bowler', color: 'blue', isBat: false },
                ].map(({ id, label, color, isBat }) => {
                  const player = (isBat ? battingPlayers : bowlingPlayers).find(p => p._id === id);
                  const stats = isBat ? getPlayerBatStats(id) : getPlayerBowlStats(id);
                  if (!player) return (
                    <div key={label} className="bg-white rounded-xl border border-dashed border-gray-200 p-4 flex items-center justify-center text-sm text-gray-300 font-medium">{label}</div>
                  );
                  const borderColor = { emerald: 'border-emerald-400 bg-emerald-50/60', gray: 'border-gray-200 bg-gray-50/60', blue: 'border-blue-400 bg-blue-50/60' }[color];
                  return (
                    <div key={label} className={`rounded-xl border-2 p-4 transition-all ${borderColor}`}>
                      <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-[0.15em]">{label}</p>
                      <p className="text-base font-bold text-gray-900 mt-1 truncate">{player.name}</p>
                      {isBat && stats ? (
                        <div className="flex items-center gap-2.5 mt-2 text-xs text-gray-500">
                          <span className="font-extrabold text-gray-800">{stats.runs}<span className="text-gray-400 font-medium">({stats.balls})</span></span>
                          <span className="font-medium">4s:{stats.fours}</span>
                          <span className="font-medium">6s:{stats.sixes}</span>
                          <span className="text-gray-400 font-medium">SR:{stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(0) : '0'}</span>
                        </div>
                      ) : !isBat && stats ? (
                        <div className="flex items-center gap-2.5 mt-2 text-xs text-gray-500">
                          <span className="font-extrabold text-gray-800">{stats.wickets}/{stats.runs}</span>
                          <span className="font-medium">({typeof stats.overs === 'number' ? parseFloat(stats.overs.toFixed(1)) : stats.overs} ov)</span>
                          <span className="text-gray-400 font-medium">Econ:{stats.economyRate || '—'}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1.5 capitalize font-medium">{player.skill?.replace(/[-_]/g, ' ')}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── RECORD DELIVERY ─── */}
            {ls && !isCompleted && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-6">Record Delivery</h3>

                {/* Player dropdowns — floating cards */}
                <div className="grid grid-cols-3 gap-4 mb-7">
                  {[
                    { label: 'Striker', value: strikerId, setter: setStrikerId, players: battingPlayers.filter(p => p._id !== nonStrikerId && !outPlayerIds.has(String(p._id))), required: true, color: 'emerald' },
                    { label: 'Non-Striker', value: nonStrikerId, setter: setNonStrikerId, players: battingPlayers.filter(p => p._id !== strikerId && !outPlayerIds.has(String(p._id))), required: false, color: 'gray' },
                    { label: 'Bowler', value: bowlerId, setter: setBowlerId, players: bowlingPlayers, required: true, color: 'blue' },
                  ].map(({ label, value, setter, players, required, color }) => (
                    <div key={label} className={`rounded-xl border bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] ${
                      value
                        ? color === 'emerald' ? 'border-emerald-200' : color === 'blue' ? 'border-blue-200' : 'border-gray-200'
                        : 'border-gray-100'
                    }`}>
                      <div className={`px-3 py-1.5 border-b text-[10px] font-bold uppercase tracking-widest rounded-t-xl ${
                        color === 'emerald' ? 'text-emerald-600 border-emerald-100 bg-emerald-50/60'
                        : color === 'blue' ? 'text-blue-600 border-blue-100 bg-blue-50/60'
                        : 'text-gray-400 border-gray-100 bg-gray-50/60'
                      }`}>
                        {label} {required && <span className="text-red-400">*</span>}
                      </div>
                      <div className="p-2">
                        <Select value={value} onChange={e => setter(e.target.value)} className="w-full" placeholder="Select...">
                          {players.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Runs */}
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-600 mb-3">Runs</label>
                  <div className="flex gap-2.5">
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <button key={n} type="button" onClick={() => setRuns(n)}
                        className={`w-12 h-12 rounded-full text-base font-extrabold border-2 transition-all active:scale-95 ${
                          runs === n
                            ? n === 4 ? 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                              : n === 6 ? 'border-purple-500 bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                              : n === 0 ? 'border-gray-400 bg-gray-100 text-gray-700'
                              : 'border-gray-900 bg-gray-900 text-white shadow-lg shadow-gray-900/25'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                        }`}>
                        {n === 0 ? <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current" /> : n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extras */}
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-600 mb-3">Extras</label>
                  <div className="flex flex-wrap gap-2">
                    {EXTRA_TYPES.map((t) => (
                      <button key={t} type="button" onClick={() => setExtras(t)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all capitalize active:scale-95 ${
                          extras === t
                            ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        }`}>
                        {t.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wicket */}
                <div className="mb-7">
                  <button
                    type="button"
                    onClick={() => setIsWicket(v => !v)}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all select-none backdrop-blur-sm ${
                      isWicket
                        ? 'bg-red-500/15 text-red-600 border border-red-200/60 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.1)]'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]'
                    }`}
                  >
                    Wicket
                  </button>
                  {isWicket && (
                    <div className="flex flex-wrap gap-2 mt-3 pl-4 border-l-2 border-red-100">
                      {WICKET_TYPES.map((t) => (
                        <button key={t} type="button" onClick={() => setWicketType(t)}
                          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all capitalize backdrop-blur-sm ${
                            wicketType === t
                              ? 'bg-red-500/15 text-red-600 border-red-200/60 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.1)]'
                              : 'border-gray-200 bg-white/80 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                          }`}>
                          {t.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-5 border-t border-gray-100">
                  <button onClick={handleRecordBall}
                    disabled={!strikerId || !bowlerId || ballMutation.isPending || oversLimitReached}
                    className="px-8 py-2.5 bg-white backdrop-blur-sm text-gray-700 text-sm font-medium rounded-full border border-gray-200 hover:bg-white hover:border-gray-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06)] disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed disabled:shadow-none">
                    <span className="inline-flex items-center gap-2">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                      {ballMutation.isPending ? 'Recording...' : oversLimitReached ? 'Over Limit Reached' : 'Record Ball'}
                    </span>
                  </button>
                  <button onClick={() => undoMutation.mutate()} disabled={undoMutation.isPending}
                    className="px-5 py-2.5 bg-white/80 backdrop-blur-sm text-gray-700 font-medium rounded-full text-sm border border-gray-200/60 hover:bg-white hover:border-gray-300 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06)] disabled:opacity-40 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    {undoMutation.isPending ? 'Undoing...' : 'Undo'}
                  </button>
                </div>
              </div>
            )}

            {/* ─── MATCH CONTROL ─── */}
            {ls && !isCompleted && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Match Control</span>
                </div>
                <div className="px-5 py-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={async () => { if (await confirm(`End innings ${ls.currentInnings}?`, { message: `${bowlingTeamName} will bat next.`, confirmText: 'End Innings' })) endInningsMutation.mutate(); }}
                    disabled={endInningsMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-sm text-gray-700 font-medium rounded-full text-sm border border-gray-200/60 hover:bg-white hover:border-gray-300 transition-all disabled:opacity-40 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    {endInningsMutation.isPending ? 'Ending...' : `End Innings ${ls.currentInnings ?? 1}`}
                  </button>
                  <button onClick={() => {
                    const opening = !showEndMatch;
                    setShowEndMatch(v => !v);
                    if (opening && ls?.innings?.length >= 2) {
                      const inn1 = ls.innings[0];
                      const inn2 = ls.innings[1];
                      const inn1Bat = inn1.battingTeamId?._id || inn1.battingTeamId;
                      const inn2Bat = inn2.battingTeamId?._id || inn2.battingTeamId;
                      // Determine winner & win type
                      let winner = '', winType = 'runs', winMargin = '', summary = '';
                      if (inn1.totalRuns > inn2.totalRuns) {
                        winner = String(inn1Bat);
                        winType = 'runs';
                        winMargin = inn1.totalRuns - inn2.totalRuns;
                        summary = `${getTeamName(inn1Bat)} won by ${winMargin} runs`;
                      } else if (inn2.totalRuns > inn1.totalRuns) {
                        winner = String(inn2Bat);
                        winType = 'wickets';
                        winMargin = 10 - (inn2.totalWickets ?? 0);
                        summary = `${getTeamName(inn2Bat)} won by ${winMargin} wickets`;
                      } else {
                        winType = 'tie';
                        summary = 'Match tied';
                      }
                      // Best batsman: highest runs across all innings
                      const allBatsmen = ls.innings.flatMap(inn => (inn.batsmen || []).map(b => ({ ...b, id: String(b.playerId?._id || b.playerId) })));
                      const bestBat = allBatsmen.reduce((best, b) => (!best || b.runs > best.runs) ? b : best, null);
                      // Best bowler: most wickets (then lowest runs)
                      const allBowlers = ls.innings.flatMap(inn => (inn.bowlers || []).map(b => ({ ...b, id: String(b.playerId?._id || b.playerId) })));
                      const bestBowl = allBowlers.reduce((best, b) => {
                        if (!best) return b;
                        if (b.wickets > best.wickets) return b;
                        if (b.wickets === best.wickets && b.runs < best.runs) return b;
                        return best;
                      }, null);
                      setEndMatchForm({
                        winner,
                        winType,
                        winMargin: String(winMargin),
                        summary,
                        manOfMatch: bestBat?.id || '',
                        bestBatsman: bestBat?.id || '',
                        bestBowler: bestBowl?.id || '',
                      });
                    }
                  }}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 font-medium rounded-full text-sm transition-all shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
                      showEndMatch
                        ? 'bg-white/80 backdrop-blur-sm text-gray-700 border border-gray-200/60 hover:bg-white hover:border-gray-300'
                        : 'bg-white/80 backdrop-blur-sm text-gray-700 border border-gray-200/60 hover:bg-white hover:border-gray-300'
                    }`}>
                    {showEndMatch ? (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Cancel
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        End Match
                      </>
                    )}
                  </button>
                </div>

                {showEndMatch && (
                  <div className="mx-5 mb-5 p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-5">
                    <h4 className="text-sm font-semibold text-gray-700">Match Result</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Winner</label>
                        <Select value={endMatchForm.winner} onChange={e => setEndMatchForm({ ...endMatchForm, winner: e.target.value })} className="w-full" placeholder="Select...">
                          <option value={team1?._id}>{team1?.name}</option>
                          <option value={team2?._id}>{team2?.name}</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Win Type</label>
                        <Select value={endMatchForm.winType} onChange={e => setEndMatchForm({ ...endMatchForm, winType: e.target.value })} className="w-full">
                          <option value="runs">By Runs</option>
                          <option value="wickets">By Wickets</option>
                          <option value="tie">Tie</option>
                          <option value="no_result">No Result</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Margin</label>
                        <input type="number" min={1} value={endMatchForm.winMargin} onChange={e => setEndMatchForm({ ...endMatchForm, winMargin: e.target.value })}
                          placeholder="e.g. 25" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Summary</label>
                        <input value={endMatchForm.summary} onChange={e => setEndMatchForm({ ...endMatchForm, summary: e.target.value })}
                          placeholder="e.g. Team A won by 25 runs" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-700 pt-1">Awards</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { key: 'manOfMatch', label: 'Man of Match' },
                        { key: 'bestBatsman', label: 'Best Batsman' },
                        { key: 'bestBowler', label: 'Best Bowler' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
                          <Select value={endMatchForm[key]} onChange={e => setEndMatchForm({ ...endMatchForm, [key]: e.target.value })} className="w-full" placeholder="Select...">
                            {[...battingPlayers, ...bowlingPlayers].map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                          </Select>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => {
                          const payload = {};
                          if (endMatchForm.winner) payload.winner = endMatchForm.winner;
                          if (endMatchForm.winType) payload.winType = endMatchForm.winType;
                          if (endMatchForm.winMargin) payload.winMargin = Number(endMatchForm.winMargin);
                          if (endMatchForm.summary) payload.summary = endMatchForm.summary;
                          if (endMatchForm.manOfMatch) payload.manOfMatch = endMatchForm.manOfMatch;
                          if (endMatchForm.bestBatsman) payload.bestBatsman = endMatchForm.bestBatsman;
                          if (endMatchForm.bestBowler) payload.bestBowler = endMatchForm.bestBowler;
                          endMatchMutation.mutate(payload);
                        }}
                        disabled={endMatchMutation.isPending}
                        className="px-6 py-2.5 bg-white/80 backdrop-blur-sm text-gray-700 font-medium rounded-full text-sm border border-gray-200/60 hover:bg-white hover:border-gray-300 transition-all disabled:opacity-40 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                        {endMatchMutation.isPending ? 'Ending...' : 'Confirm End Match'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {sport === 'badminton' && (
          <>
            {/* ─── Match Confirmation ─── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">Match Participants</h3>
              <div className="grid grid-cols-3 gap-3 items-center">
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-700 mb-1">{team1?.name}</div>
                  <div className="text-xs text-gray-500">Team 1</div>
                </div>
                <div className="text-center text-gray-400 font-bold">vs</div>
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-700 mb-1">{team2?.name}</div>
                  <div className="text-xs text-gray-500">Team 2</div>
                </div>
              </div>
            </div>

            {/* Start Match */}
            {!ls && match?.status === 'upcoming' && (
              <div className="flex justify-center py-3">
                <button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}
                  className="px-12 py-4 bg-gray-900 text-white font-extrabold rounded-2xl hover:bg-gray-800 transition-all disabled:opacity-50 text-lg shadow-lg hover:shadow-xl active:scale-[0.98]">
                  {startMutation.isPending ? 'Starting...' : 'Start Match'}
                </button>
              </div>
            )}

            {/* Badminton Scorecard */}
            {ls && team1 && team2 && (
              <BadmintonScoringForm match={match} liveScore={ls} matchId={matchId} qc={qc} team1={team1} team2={team2} />
            )}
          </>
        )}

        {sport === 'football' && match && (
          <FootballScoringForm match={match} liveScore={ls} matchId={matchId} qc={qc} />
        )}
      </div>

      {/* ─── RIGHT: Innings History ─── */}
      {sport === 'cricket' && ls && ls.innings?.length > 0 && (
        <div className="w-[420px] shrink-0 space-y-3 overflow-y-auto max-h-[calc(100vh-4rem)] pr-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest sticky top-0 bg-gray-100/95 backdrop-blur-sm py-3 z-10">Innings History</h3>

          {ls.innings.map((inn, idx) => {
            const innBatTeam = getTeamName(inn.battingTeamId);
            const isCurrent = idx === (ls.currentInnings ?? 1) - 1;
            const overs = inn.totalOvers ?? 0;
            const rr = overs > 0 ? (inn.totalRuns / overs).toFixed(2) : '0.00';
            const extrasObj = inn.extras || {};
            const extrasTotal = extrasObj.total || 0;
            const batted = (inn.batsmen || []).filter(b => b.runs > 0 || b.balls > 0 || b.isOut);
            const bowled = (inn.bowlers || []).filter(b => b.overs > 0 || b.wickets > 0);

            // Skip innings with no activity (no balls bowled)
            if (batted.length === 0 && bowled.length === 0 && overs === 0 && (inn.totalRuns ?? 0) === 0) return null;

            return (
              <div key={idx} className={`rounded-xl border overflow-hidden bg-white ${isCurrent ? 'border-emerald-300 ring-1 ring-emerald-300/30 shadow-sm' : 'border-gray-200'}`}>
                <div className={`px-4 py-3 flex items-center justify-between ${isCurrent ? 'bg-emerald-50/70' : 'bg-gray-50/70'}`}>
                  <div>
                    <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isCurrent ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {isCurrent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse align-middle" />}
                      Innings {idx + 1}
                    </p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{innBatTeam}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-black ${isCurrent ? 'text-emerald-700' : 'text-gray-900'}`}>
                      {inn.totalRuns ?? 0}/{inn.totalWickets ?? 0}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">{overs} ov | RR {rr}</p>
                  </div>
                </div>

                {batted.length > 0 && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-400">
                          <th className="px-3 py-1.5 text-left font-bold">Batter</th>
                          <th className="px-2 py-1.5 text-center font-bold">R</th>
                          <th className="px-2 py-1.5 text-center font-bold">B</th>
                          <th className="px-2 py-1.5 text-center font-bold">4s</th>
                          <th className="px-2 py-1.5 text-center font-bold">6s</th>
                          <th className="px-2 py-1.5 text-center font-bold">SR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {batted.map((b, i) => (
                          <tr key={i} className="hover:bg-gray-50/40">
                            <td className="px-3 py-1.5">
                              <span className="text-gray-700 font-semibold">{b.playerId?.name || '—'}</span>
                              {b.isOut ? <span className="text-gray-400 text-[10px] ml-1">{b.dismissalType}</span> : <span className="text-emerald-500 text-[10px] ml-0.5 font-extrabold">*</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center font-extrabold text-gray-900">{b.runs}</td>
                            <td className="px-2 py-1.5 text-center text-gray-500 font-medium">{b.balls}</td>
                            <td className="px-2 py-1.5 text-center text-gray-500 font-medium">{b.fours}</td>
                            <td className="px-2 py-1.5 text-center text-gray-500 font-medium">{b.sixes}</td>
                            <td className="px-2 py-1.5 text-center text-gray-400 font-medium">{b.balls ? ((b.runs / b.balls) * 100).toFixed(0) : '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {extrasTotal > 0 && (
                  <div className="px-3 py-1.5 border-t border-gray-100 flex justify-between text-[11px]">
                    <span className="font-bold text-gray-500">Extras</span>
                    <span className="text-gray-500 font-medium">{extrasTotal} (w{extrasObj.wides || 0} nb{extrasObj.noBalls || 0} b{extrasObj.byes || 0} lb{extrasObj.legByes || 0})</span>
                  </div>
                )}

                <div className="px-3 py-2 border-t border-gray-200 bg-gray-50/50 flex justify-between text-xs">
                  <span className="font-extrabold text-gray-600">Total</span>
                  <span className="font-extrabold text-gray-900">{inn.totalRuns ?? 0}/{inn.totalWickets ?? 0} ({overs} ov)</span>
                </div>

                {bowled.length > 0 && (
                  <div className="border-t border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-400">
                          <th className="px-3 py-1.5 text-left font-bold">Bowler</th>
                          <th className="px-2 py-1.5 text-center font-bold">O</th>
                          <th className="px-2 py-1.5 text-center font-bold">M</th>
                          <th className="px-2 py-1.5 text-center font-bold">R</th>
                          <th className="px-2 py-1.5 text-center font-bold">W</th>
                          <th className="px-2 py-1.5 text-center font-bold">Eco</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {bowled.map((b, i) => (
                          <tr key={i} className="hover:bg-gray-50/40">
                            <td className="px-3 py-1.5 text-gray-700 font-semibold">{b.playerId?.name || '—'}</td>
                            <td className="px-2 py-1.5 text-center text-gray-500 font-medium">{typeof b.overs === 'number' ? parseFloat(b.overs.toFixed(1)) : b.overs}</td>
                            <td className="px-2 py-1.5 text-center text-gray-500 font-medium">{b.maidens}</td>
                            <td className="px-2 py-1.5 text-center text-gray-500 font-medium">{b.runs}</td>
                            <td className="px-2 py-1.5 text-center font-extrabold text-emerald-600">{b.wickets}</td>
                            <td className="px-2 py-1.5 text-center text-gray-400 font-medium">{b.overs ? (b.runs / b.overs).toFixed(1) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {inn.fallOfWickets?.length > 0 && (
                  <div className="px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-400">
                    <span className="font-bold text-gray-500">FOW: </span>
                    {inn.fallOfWickets.map((f, i) => <span key={i}>{i > 0 && ', '}{f.runs}-{f.wicketNumber}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BadmintonScoringForm({ match, liveScore, matchId, qc, team1, team2 }) {
  if (!liveScore || !team1 || !team2) {
    return <div className="text-center py-8 text-gray-500">Loading badminton match data...</div>;
  }

  const badmintonData = liveScore.badmintonData || {};
  const [team1Points, setTeam1Points] = useState(badmintonData.team1Points || 0);
  const [team2Points, setTeam2Points] = useState(badmintonData.team2Points || 0);
  const [currentGame, setCurrentGame] = useState(badmintonData.currentGame || 1);

  // Sync with liveScore updates
  useEffect(() => {
    const data = liveScore?.badmintonData;
    if (data) {
      setTeam1Points(data.team1Points ?? 0);
      setTeam2Points(data.team2Points ?? 0);
      setCurrentGame(data.currentGame ?? 1);
    }
  }, [liveScore]);

  const pointMutation = useMutation({
    mutationFn: (data) => api.post(`/livescores/${matchId}/ball`, data),
    onSuccess: () => {
      toast.success('Point recorded');
      qc.invalidateQueries(['livescore', matchId]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const recordPoint = (teamId) => {
    pointMutation.mutate({
      scoringTeamId: teamId,
      points: 1,
      game: currentGame,
    });
  };

  const adjustPoint = (teamId, delta) => {
    pointMutation.mutate({
      scoringTeamId: teamId,
      points: delta,
      game: currentGame,
    });
  };

  const endGameMutation = useMutation({
    mutationFn: () => api.post(`/livescores/${matchId}/next-game`),
    onSuccess: (data) => {
      const message = data.data.message || 'Game ended';
      toast.success(message);
      qc.invalidateQueries(['livescore', matchId]);
      qc.invalidateQueries(['match', matchId]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to start next game'),
  });

  const isMatchCompleted = match?.status === 'completed';
  const gameWinner = team1Points > team2Points ? team1?.name : team2Points > team1Points ? team2?.name : null;
  const gameHasWinner = team1Points >= 21 || team2Points >= 21;

  // Count completed games from history for decider detection
  const gameHistory = badmintonData.gameHistory || [];
  const t1Id = String(team1?._id || '');
  const t2Id = String(team2?._id || '');
  const t1GameWins = gameHistory.filter((g) => String(g.winner) === t1Id).length;
  const t2GameWins = gameHistory.filter((g) => String(g.winner) === t2Id).length;
  const isDeciderGame = currentGame >= 3 || t1GameWins === 2 || t2GameWins === 2;

  // ═══════════════════════════════════════════
  // COMPLETED MATCH — read-only review
  // ═══════════════════════════════════════════
  if (isMatchCompleted) {
    const resultScores = Array.isArray(match?.result?.scores) && match.result.scores.length
      ? match.result.scores
      : gameHistory;
    const winnerId = String(match?.result?.winner?._id || match?.result?.winner || '');
    const t1IsWinner = winnerId === t1Id;
    const t2IsWinner = winnerId === t2Id;
    const t1TotalGames = resultScores.filter((g) => (g.team1Points ?? 0) > (g.team2Points ?? 0)).length;
    const t2TotalGames = resultScores.filter((g) => (g.team2Points ?? 0) > (g.team1Points ?? 0)).length;

    return (
      <div className="space-y-4">
        {/* Final Score Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
          <p className="text-xs text-emerald-400 uppercase tracking-widest mb-3 font-bold">● Match Completed</p>
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <p className={`text-5xl font-black mb-1 ${t1IsWinner ? 'text-emerald-400' : 'text-gray-500'}`}>{t1TotalGames}</p>
              <p className={`text-sm font-semibold ${t1IsWinner ? 'text-white' : 'text-gray-400'}`}>
                {team1?.name}
                {t1IsWinner && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Winner</span>}
              </p>
            </div>
            <div className="text-center text-xs text-gray-400 uppercase tracking-widest font-bold">Games</div>
            <div className="text-center">
              <p className={`text-5xl font-black mb-1 ${t2IsWinner ? 'text-emerald-400' : 'text-gray-500'}`}>{t2TotalGames}</p>
              <p className={`text-sm font-semibold ${t2IsWinner ? 'text-white' : 'text-gray-400'}`}>
                {team2?.name}
                {t2IsWinner && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Winner</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Per-game breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-4">Game-by-Game</h3>
          <div className="space-y-2">
            {resultScores.map((g, i) => {
              const t1Won = (g.team1Points ?? 0) > (g.team2Points ?? 0);
              return (
                <div key={i} className="grid grid-cols-5 items-center gap-3 py-2 border-b last:border-b-0 border-gray-100">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Game {g.gameNumber ?? i + 1}</div>
                  <div className={`text-right text-xl font-black tabular-nums ${t1Won ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {g.team1Points ?? 0}
                  </div>
                  <div className="text-center text-[10px] text-gray-300 font-bold">—</div>
                  <div className={`text-left text-xl font-black tabular-nums ${!t1Won ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {g.team2Points ?? 0}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {t1Won ? team1?.name : team2?.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {match?.result?.summary && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm font-semibold text-emerald-700 text-center">{match.result.summary}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // LIVE / UPCOMING — active scoring controls
  // ═══════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* Match Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">
          Game {currentGame} of 3 {isDeciderGame && currentGame >= 3 && <span className="text-amber-400 ml-2">● Decider</span>}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-4xl font-black mb-1">{team1Points}</p>
            <p className="text-sm font-semibold text-gray-300">
              {team1?.name}
              <span className="ml-2 text-[10px] text-gray-500">({t1GameWins})</span>
            </p>
          </div>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider">vs</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-4xl font-black mb-1">{team2Points}</p>
            <p className="text-sm font-semibold text-gray-300">
              {team2?.name}
              <span className="ml-2 text-[10px] text-gray-500">({t2GameWins})</span>
            </p>
          </div>
        </div>
      </div>

      {/* Scoring Buttons */}
      <div className="grid grid-cols-2 gap-4">
        {/* Team 1 */}
        <div className="flex items-stretch gap-2">
          <button onClick={() => recordPoint(team1?._id)}
            disabled={pointMutation.isPending || gameHasWinner}
            className="flex-1 py-6 px-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-lg text-emerald-700 shadow-sm hover:shadow-md">
            +1 Point<br/><span className="text-xs text-emerald-600 font-semibold">{team1?.name}</span>
          </button>
          <button onClick={() => adjustPoint(team1?._id, -1)}
            disabled={pointMutation.isPending || team1Points <= 0}
            title="Undo last point"
            className="w-14 rounded-2xl bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-emerald-700 shadow-sm">
            −1
          </button>
        </div>
        {/* Team 2 */}
        <div className="flex items-stretch gap-2">
          <button onClick={() => recordPoint(team2?._id)}
            disabled={pointMutation.isPending || gameHasWinner}
            className="flex-1 py-6 px-4 rounded-2xl bg-blue-50 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-lg text-blue-700 shadow-sm hover:shadow-md">
            +1 Point<br/><span className="text-xs text-blue-600 font-semibold">{team2?.name}</span>
          </button>
          <button onClick={() => adjustPoint(team2?._id, -1)}
            disabled={pointMutation.isPending || team2Points <= 0}
            title="Undo last point"
            className="w-14 rounded-2xl bg-white border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold text-blue-700 shadow-sm">
            −1
          </button>
        </div>
      </div>

      {/* Game Status */}
      {gameHasWinner && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6">
          <p className="text-center font-bold text-lg text-amber-900 mb-4">
            {gameWinner} wins this game!
          </p>
          {/* If this game win decides the match (2 games won), offer End Match */}
          {(() => {
            // Projected game-wins AFTER this game is confirmed
            const t1Proj = t1GameWins + (team1Points > team2Points ? 1 : 0);
            const t2Proj = t2GameWins + (team2Points > team1Points ? 1 : 0);
            const matchDecided = t1Proj >= 2 || t2Proj >= 2;
            if (matchDecided) {
              return (
                <button onClick={() => endGameMutation.mutate()}
                  disabled={endGameMutation.isPending}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all">
                  {endGameMutation.isPending ? 'Ending Match...' : 'End Match'}
                </button>
              );
            }
            return (
              <button onClick={() => endGameMutation.mutate()}
                disabled={endGameMutation.isPending}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all">
                {endGameMutation.isPending ? 'Starting Next Game...' : 'Start Game ' + (currentGame + 1)}
              </button>
            );
          })()}
        </div>
      )}

      {/* Match Statistics */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Points Required to Win</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-emerald-700">{Math.max(0, 21 - team1Points)}</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">{team1?.name}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-blue-700">{Math.max(0, 21 - team2Points)}</p>
            <p className="text-xs text-blue-600 font-semibold mt-1">{team2?.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FootballScoringForm({ match, liveScore, matchId, qc }) {
  return <div className="text-gray-500 text-center py-8">Football scoring panel</div>;
}
