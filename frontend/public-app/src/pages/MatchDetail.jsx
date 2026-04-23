import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { liveScoreSocket } from '../services/socket';
import dayjs from 'dayjs';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { MapPin, Calendar } from '../components/ui/Icons';

function TrophyIcon({ className = '' }) {
  return (
    <svg className={className} width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 14h6v3H9z" fill="#f59e0b" stroke="#b45309" strokeWidth="1.2"/>
    </svg>
  );
}

const CONFETTI_COLORS = ['#facc15', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#06b6d4'];
const CONFETTI_PARTICLES = Array.from({ length: 34 }).map((_, i) => {
  const spread = (Math.random() - 0.5) * Math.PI * 1.2;
  const angle = -Math.PI / 2 + spread;
  const velocity = 55 + Math.random() * 55;
  const ax = Math.cos(angle) * velocity;
  const ay = Math.sin(angle) * velocity;
  const fx = ax + (Math.random() - 0.5) * 40;
  const fy = 60 + Math.random() * 40;
  const isRound = Math.random() < 0.3;
  const size = isRound ? 4 + Math.random() * 3 : 5 + Math.random() * 4;
  return {
    i,
    ax, ay, fx, fy,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rot: (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 720) + 360),
    delay: Math.random() * 0.25,
    duration: 1.6 + Math.random() * 1.0,
    isRound,
    w: size,
    h: isRound ? size : size * 1.8,
  };
});

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-10">
      <div className="absolute top-1/2 left-1/2">
        {CONFETTI_PARTICLES.map((p) => (
          <span
            key={p.i}
            className={`block absolute ${p.isRound ? 'rounded-full' : 'rounded-[1px]'}`}
            style={{
              width: `${p.w}px`,
              height: `${p.h}px`,
              background: p.color,
              left: 0,
              top: 0,
              boxShadow: `0 0 4px ${p.color}66`,
              '--ax': `${p.ax}px`,
              '--ay': `${p.ay}px`,
              '--fx': `${p.fx}px`,
              '--fy': `${p.fy}px`,
              '--rot': `${p.rot}deg`,
              animation: `popper-burst ${p.duration}s ${p.delay}s cubic-bezier(0.22, 0.7, 0.5, 1) forwards`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const confettiKeyframes = `
@keyframes popper-burst {
  0%   { transform: translate(0, 0) rotate(0deg) scale(0.3); opacity: 0; }
  8%   { opacity: 1; transform: translate(calc(var(--ax) * 0.3), calc(var(--ay) * 0.3)) rotate(calc(var(--rot) * 0.2)) scale(1); }
  40%  { transform: translate(var(--ax), var(--ay)) rotate(calc(var(--rot) * 0.55)); opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translate(var(--fx), var(--fy)) rotate(var(--rot)) scale(0.7); opacity: 0; }
}
`;

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [liveData, setLiveData] = useState(null);

  const { data: match, isLoading, refetch } = useQuery({
    queryKey: ['match', id],
    queryFn: () => api.get(`/matches/${id}`).then((r) => r.data.match),
  });

  const { data: livescoreData, refetch: refetchLive } = useQuery({
    queryKey: ['livescore', id],
    queryFn: () => api.get(`/livescores/${id}`).then((r) => r.data.data || r.data),
    enabled: !!id,
    refetchInterval: match?.status === 'live' ? 1000 : 5000, // Refetch every 1 second during live, 5 seconds otherwise
  });

  const team1PlayersId = match?.team1Id?._id || match?.team1Id;
  const team2PlayersId = match?.team2Id?._id || match?.team2Id;

  const { data: team1Players } = useQuery({
    queryKey: ['team-players', team1PlayersId],
    queryFn: () => api.get(`/teams/${team1PlayersId}/players`).then((r) => r.data?.players || []),
    enabled: !!team1PlayersId,
  });

  const { data: team2Players } = useQuery({
    queryKey: ['team-players', team2PlayersId],
    queryFn: () => api.get(`/teams/${team2PlayersId}/players`).then((r) => r.data?.players || []),
    enabled: !!team2PlayersId,
  });

  const handleSocketEvent = useCallback(() => {
    refetch();
    refetchLive();
  }, [refetch, refetchLive]);

  useEffect(() => {
    liveScoreSocket.connect();
    liveScoreSocket.emit('join-match', id);
    liveScoreSocket.on('ball-update', handleSocketEvent);
    liveScoreSocket.on('wicket', handleSocketEvent);
    liveScoreSocket.on('innings-end', handleSocketEvent);
    liveScoreSocket.on('match-end', handleSocketEvent);
    liveScoreSocket.on('football-event', handleSocketEvent);
    liveScoreSocket.on('game-reset', handleSocketEvent);
    return () => {
      liveScoreSocket.emit('leave-match', id);
      liveScoreSocket.off('ball-update', handleSocketEvent);
      liveScoreSocket.off('wicket', handleSocketEvent);
      liveScoreSocket.off('innings-end', handleSocketEvent);
      liveScoreSocket.off('match-end', handleSocketEvent);
      liveScoreSocket.off('football-event', handleSocketEvent);
      liveScoreSocket.off('game-reset', handleSocketEvent);
      liveScoreSocket.disconnect();
    };
  }, [id, handleSocketEvent]);

  useEffect(() => {
    if (livescoreData) setLiveData(livescoreData);
  }, [livescoreData]);

  const winnerIdStr = match?.result?.winner ? String(match.result.winner?._id || match.result.winner) : null;
  const team1IdStr = match ? String(match.team1Id?._id || match.team1Id || '') : '';
  const team2IdStr = match ? String(match.team2Id?._id || match.team2Id || '') : '';
  const winnerSide = match?.status === 'completed' && winnerIdStr
    ? (winnerIdStr === team1IdStr ? 'team1' : winnerIdStr === team2IdStr ? 'team2' : null)
    : null;

  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (!winnerSide) {
      setShowConfetti(false);
      return;
    }
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(t);
  }, [winnerSide]);

  if (isLoading) {
    return <Spinner />;
  }

  if (!match) {
    return <p className="text-slate-500 dark:text-gray-400 text-center py-16">Match not found.</p>;
  }

  const sport = match?.tournamentId?.sport || 'cricket';
  const innings = liveData?.innings || [];
  const footballData = liveData?.footballData || null;

  // Normalize badmintonData.gamesWon — it may arrive as a plain object (from Map JSON
  // serialization) or as a Mongoose Map shape depending on the response path. Expose a
  // helper that works with both.
  const badmintonData = liveData?.badmintonData || null;
  const gamesWonFor = (teamId) => {
    if (!badmintonData?.gamesWon || !teamId) return 0;
    const gw = badmintonData.gamesWon;
    if (typeof gw.get === 'function') return gw.get(String(teamId)) || 0;
    return gw[String(teamId)] || 0;
  };

  // BWF rule: a game is won when a side reaches 21 with a 2-point lead, or hits 30.
  // We only use this for display badges; actual game-end logic lives server-side.
  const hasWonGame = (myPts, theirPts) => {
    const mine = myPts || 0;
    const theirs = theirPts || 0;
    if (mine >= 30) return true;
    if (mine >= 21 && mine - theirs >= 2) return true;
    return false;
  };

  const halfLabel = {
    not_started: 'Not Started',
    '1st': '1st Half',
    half_time: 'Half Time',
    '2nd': '2nd Half',
    full_time: 'Full Time',
  };

  return (
    <div className="space-y-6">
      <style>{confettiKeyframes}</style>
      {/* Match header */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <StatusBadge status={match.status} />
          {match.tournamentId && (
            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{match.tournamentId?.name || match.tournamentId}</span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              {winnerSide === 'team1' && <TrophyIcon className="shrink-0 drop-shadow-sm" />}
              <span className="relative inline-block">
                {winnerSide === 'team1' && showConfetti && <Confetti />}
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{match.team1Id?.name || 'Team A'}</span>
              </span>
            </div>
          </div>
          <div className="text-slate-400 dark:text-gray-500 font-bold text-lg px-4">VS</div>
          <div className="flex-1 text-right">
            <div className="flex items-center justify-center sm:justify-end gap-2">
              <span className="relative inline-block">
                {winnerSide === 'team2' && showConfetti && <Confetti />}
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{match.team2Id?.name || 'Team B'}</span>
              </span>
              {winnerSide === 'team2' && <TrophyIcon className="shrink-0 drop-shadow-sm" />}
            </div>
          </div>
        </div>

        {match.result?.summary && (
          <div className="mt-4 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{match.result.summary}</div>
        )}

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-gray-400">
          {match.venue && <span className="flex items-center gap-1"><MapPin size={14} /> {match.venue}</span>}
          <span className="flex items-center gap-1"><Calendar size={14} /> {dayjs(match.date).format('DD MMM YYYY, HH:mm')}</span>
        </div>
      </div>

      {/* Players section — badminton shows only the on-court pair; other sports show full squads */}
      {(() => {
        // For badminton, prefer the on-court selections from the Match document.
        // Fall back to the full team roster (legacy matches without player assignment).
        const isBadmintonView = sport === 'badminton';
        const onCourtT1 = Array.isArray(match.team1Players) ? match.team1Players : [];
        const onCourtT2 = Array.isArray(match.team2Players) ? match.team2Players : [];
        const useOnCourt = isBadmintonView && (onCourtT1.length > 0 || onCourtT2.length > 0);

        const t1List = useOnCourt ? onCourtT1 : (team1Players || []);
        const t2List = useOnCourt ? onCourtT2 : (team2Players || []);
        if (t1List.length === 0 && t2List.length === 0) return null;

        const sectionLabel = useOnCourt ? 'On court' : (isBadmintonView ? 'Squad' : 'Squad');
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { team: match.team1Id, players: t1List, accent: 'emerald' },
              { team: match.team2Id, players: t2List, accent: 'blue' },
            ].map(({ team, players, accent }, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className={`px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50 flex items-center justify-between`}>
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-semibold">{team?.name || 'Team'}</h3>
                    {useOnCourt && (
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 mt-0.5">{sectionLabel}</p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${accent === 'emerald' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    {players.length} {players.length === 1 ? 'player' : 'players'}
                  </span>
                </div>
                {players.length === 0 ? (
                  <p className="px-6 py-6 text-sm text-slate-500 dark:text-gray-400 text-center">
                    {useOnCourt ? 'No players assigned for this match yet.' : 'No players assigned.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-gray-700">
                    {players.map((p) => (
                      <li
                        key={p._id}
                        onClick={() => navigate(`/players/${p._id}`)}
                        className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {p.photo ? (
                            <img src={p.photo} alt={p.name} className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-gray-700" />
                          ) : (
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${accent === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                              {(p.name || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-slate-900 dark:text-white font-semibold text-sm truncate">{p.name}</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 capitalize">
                              {p.skill || '-'}{p.age ? ` • ${p.age} yrs` : ''}
                            </p>
                          </div>
                        </div>
                        {p.basePoints != null && (
                          <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 shrink-0">
                            {p.basePoints} pts
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Cricket scorecards */}
      {sport === 'cricket' && (
        innings.length === 0 ? (
          <div className="bg-white dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-800/60 rounded-2xl border border-slate-200 dark:border-gray-700/60 overflow-hidden shadow-sm">
            {(match.status === 'upcoming' || match.status === 'scheduled') ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mb-5">
                  <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-slate-900 dark:text-white text-lg font-bold tracking-tight mb-2">Match Starting Soon</p>
                <p className="text-slate-500 dark:text-gray-400 text-sm mb-6 max-w-sm">
                  This match hasn't started yet. Stay tuned for live updates!
                </p>
                {match.date && (
                  <div className="inline-flex items-center gap-3 bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700/60 rounded-xl px-5 py-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wider font-medium">Scheduled</p>
                      <p className="text-slate-900 dark:text-white font-bold text-lg mt-0.5">{dayjs(match.date).format('DD MMM YYYY')}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">{dayjs(match.date).format('hh:mm A')}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 dark:text-gray-500">No scorecard data available.</div>
            )}
          </div>
        ) : (
          innings.map((inning, idx) => {
            const extras = inning.extras || {};
            const extrasTotal = extras.total || (extras.wides || 0) + (extras.noBalls || 0) + (extras.byes || 0) + (extras.legByes || 0);
            const overs = inning.totalOvers ?? '–';
            const runRate = inning.totalOvers > 0 ? (inning.totalRuns / inning.totalOvers).toFixed(1) : '–';
            const didNotBat = inning.batsmen ? inning.batsmen.filter((b) => !b.isOut && b.balls === 0 && b.runs === 0) : [];
            const batted = inning.batsmen ? inning.batsmen.filter((b) => b.isOut || b.balls > 0 || b.runs > 0) : [];
            const fow = inning.fallOfWickets || [];
            const bowled = inning.bowlers ? inning.bowlers.filter((b) => b.overs > 0 || b.wickets > 0) : [];

            // Skip innings with no activity
            if (batted.length === 0 && bowled.length === 0 && (inning.totalOvers ?? 0) === 0 && (inning.totalRuns ?? 0) === 0) return null;

            return (
              <div key={idx} className="bg-white dark:bg-gray-800/80 rounded-2xl border border-slate-200 dark:border-gray-700/60 overflow-hidden shadow-sm">
                {/* Innings Header */}
                <div className="bg-emerald-50 dark:bg-emerald-900/30 px-6 py-4 border-b border-emerald-100 dark:border-emerald-800/30 flex items-center justify-between">
                  <h3 className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">
                    {inning.battingTeamId?.name || `Innings ${idx + 1}`}
                  </h3>
                  {inning.totalRuns != null && (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xl tracking-tight">
                      {inning.totalRuns}-{inning.totalWickets ?? 0}
                      <span className="text-emerald-500/70 dark:text-emerald-400/70 font-normal text-sm ml-1.5">({overs} Ov)</span>
                    </span>
                  )}
                </div>

                {/* Batting Table */}
                {batted.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-gray-700/60 bg-slate-50 dark:bg-gray-900/30">
                          <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Batter</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider min-w-[140px]"></th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">R</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">B</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">4s</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">6s</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batted.map((b, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-gray-800/60 hover:bg-slate-50 dark:hover:bg-gray-700/20 transition-colors">
                            <td className="px-5 py-3">
                              <span
                                className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm hover:underline cursor-pointer"
                                onClick={() => b.playerId?._id && navigate(`/players/${b.playerId._id}`)}
                              >
                                {b.playerId?.name || '–'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-400 dark:text-gray-500 text-xs">
                              {b.isOut ? (
                                <span>{b.dismissalType || 'out'}{b.dismissedBy?.name ? ` ${b.dismissedBy.name}` : ''}</span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-500 font-medium">not out</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-slate-900 dark:text-white text-base">{b.runs ?? 0}</td>
                            <td className="px-3 py-3 text-center text-slate-500 dark:text-gray-400">{b.balls ?? 0}</td>
                            <td className="px-3 py-3 text-center text-slate-500 dark:text-gray-400">{b.fours ?? 0}</td>
                            <td className="px-3 py-3 text-center text-slate-500 dark:text-gray-400">{b.sixes ?? 0}</td>
                            <td className="px-3 py-3 text-center text-slate-500 dark:text-gray-400">
                              {b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Extras */}
                {extrasTotal > 0 && (
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700/40 flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-500 dark:text-gray-400">Extras</span>
                    <span className="text-slate-700 dark:text-gray-300">
                      <span className="font-bold text-slate-900 dark:text-white">{extrasTotal}</span>
                      <span className="text-slate-400 dark:text-gray-500 text-xs ml-2">
                        (b {extras.byes || 0}, lb {extras.legByes || 0}, w {extras.wides || 0}, nb {extras.noBalls || 0})
                      </span>
                    </span>
                  </div>
                )}

                {/* Total */}
                {inning.totalRuns != null && (
                  <div className="px-5 py-3 border-t border-slate-200 dark:border-gray-600/40 bg-slate-50 dark:bg-gray-900/30 flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-900 dark:text-white">Total</span>
                    <span className="text-slate-900 dark:text-white">
                      <span className="font-bold text-lg">{inning.totalRuns}-{inning.totalWickets ?? 0}</span>
                      <span className="text-slate-400 dark:text-gray-400 text-xs ml-2">({overs} Overs, RR: {runRate})</span>
                    </span>
                  </div>
                )}

                {/* Did Not Bat */}
                {didNotBat.length > 0 && (
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700/40 text-sm">
                    <span className="font-bold text-slate-400 dark:text-gray-400 mr-3">Did not Bat</span>
                    <span className="text-emerald-600 dark:text-emerald-400/80">
                      {didNotBat.map((b) => b.playerId?.name || '–').join(', ')}
                    </span>
                  </div>
                )}

                {/* Fall of Wickets */}
                {fow.length > 0 && (
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-gray-700/40 text-sm">
                    <span className="font-bold text-slate-400 dark:text-gray-400 mr-3">Fall of Wickets</span>
                    <span className="text-slate-400 dark:text-gray-500 text-xs">
                      {fow.map((f) => `${f.runs}-${f.wicketNumber} (${f.playerId?.name || '?'}, ${typeof f.overs === 'number' ? parseFloat(f.overs.toFixed(1)) : f.overs} ov)`).join(' • ')}
                    </span>
                  </div>
                )}

                {/* Bowling Table */}
                {inning.bowlers && inning.bowlers.length > 0 && (
                  <div className="overflow-x-auto border-t border-slate-200 dark:border-gray-600/40">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-gray-700/60 bg-slate-50 dark:bg-gray-900/30">
                          <th className="px-5 py-3 text-left text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Bowler</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">O</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">M</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">R</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">W</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">NB</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">WD</th>
                          <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">ECO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inning.bowlers.map((b, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-gray-800/60 hover:bg-slate-50 dark:hover:bg-gray-700/20 transition-colors">
                            <td className="px-5 py-3">
                              <span
                                className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm hover:underline cursor-pointer"
                                onClick={() => b.playerId?._id && navigate(`/players/${b.playerId._id}`)}
                              >
                                {b.playerId?.name || '–'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center text-slate-600 dark:text-gray-300">{typeof b.overs === 'number' ? parseFloat(b.overs.toFixed(1)) : (b.overs ?? 0)}</td>
                            <td className="px-3 py-3 text-center text-slate-600 dark:text-gray-300">{b.maidens ?? 0}</td>
                            <td className="px-3 py-3 text-center font-bold text-slate-900 dark:text-white">{b.runs ?? 0}</td>
                            <td className="px-3 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400 text-base">{b.wickets ?? 0}</td>
                            <td className="px-3 py-3 text-center text-slate-500 dark:text-gray-400">{b.noBalls ?? 0}</td>
                            <td className="px-3 py-3 text-center text-slate-500 dark:text-gray-400">{b.wides ?? 0}</td>
                            <td className="px-3 py-3 text-center text-slate-500 dark:text-gray-400 font-medium">
                              {b.overs ? (b.runs / b.overs).toFixed(2) : '0.00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )
      )}

      {/* Football scorecards */}
      {sport === 'football' && (
        <div className="space-y-4">
          {/* Score header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-slate-200 dark:border-gray-700 text-center shadow-sm">
            <div className="flex items-center justify-center gap-6">
              <p className="text-xl font-semibold text-slate-900 dark:text-white">
                {footballData?.homeTeamId?.name || match.team1Id?.name || 'Home'}
              </p>
              <p className="text-5xl font-bold text-slate-900 dark:text-white tabular-nums">
                {footballData?.homeGoals ?? 0}
                <span className="mx-3 text-slate-300 dark:text-gray-500">-</span>
                {footballData?.awayGoals ?? 0}
              </p>
              <p className="text-xl font-semibold text-slate-900 dark:text-white">
                {footballData?.awayTeamId?.name || match.team2Id?.name || 'Away'}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              {footballData?.currentHalf && (
                <span className="bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-200 text-xs font-bold px-3 py-1 rounded-full uppercase">
                  {halfLabel[footballData.currentHalf] || footballData.currentHalf}
                </span>
              )}
              {footballData?.currentMinute != null && footballData.currentMinute > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  {footballData.currentMinute}'
                </span>
              )}
            </div>
          </div>

          {/* Goals */}
          {footballData?.goals && footballData.goals.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="px-6 py-3 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-slate-900 dark:text-white font-semibold">Goals</h3>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-gray-800">
                {footballData.goals.map((goal, i) => (
                  <li key={i} className="px-6 py-3 flex items-center gap-3">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm w-10 shrink-0">{goal.minute}'</span>
                    <span className="text-slate-900 dark:text-white text-sm flex-1">
                      {goal.playerId?.name || goal.playerId || 'Unknown'}
                      {goal.assistedBy && (
                        <span className="text-slate-400 dark:text-gray-400 text-xs ml-1">
                          (assist: {goal.assistedBy?.name || goal.assistedBy})
                        </span>
                      )}
                    </span>
                    <div className="flex gap-2 shrink-0">
                      {goal.isOwnGoal && (
                        <span className="bg-red-50 dark:bg-red-700/30 text-red-600 dark:text-red-400 text-xs font-semibold px-2 py-0.5 rounded-full">OG</span>
                      )}
                      {goal.isPenalty && (
                        <span className="bg-amber-50 dark:bg-yellow-700/30 text-amber-700 dark:text-yellow-400 text-xs font-semibold px-2 py-0.5 rounded-full">PEN</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cards */}
          {footballData?.cards && footballData.cards.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="px-6 py-3 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-slate-900 dark:text-white font-semibold">Cards</h3>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-gray-800">
                {footballData.cards.map((card, i) => (
                  <li key={i} className="px-6 py-3 flex items-center gap-3">
                    <span
                      className={`w-4 h-5 rounded-sm shrink-0 ${card.cardType === 'red' ? 'bg-red-500' : 'bg-yellow-400'}`}
                      title={card.cardType === 'red' ? 'Red card' : 'Yellow card'}
                    />
                    <span className="text-slate-900 dark:text-white text-sm flex-1">
                      {card.playerId?.name || card.playerId || 'Unknown'}
                    </span>
                    <span className="text-slate-400 dark:text-gray-400 text-sm shrink-0">{card.minute}'</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Substitutions */}
          {footballData?.substitutions && footballData.substitutions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="px-6 py-3 border-b border-slate-100 dark:border-gray-700">
                <h3 className="text-slate-900 dark:text-white font-semibold">Substitutions</h3>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-gray-800">
                {footballData.substitutions.map((sub, i) => (
                  <li key={i} className="px-6 py-3 flex items-center gap-2 text-sm">
                    <span className="text-slate-400 dark:text-gray-400 font-bold w-10 shrink-0">{sub.minute}'</span>
                    <span className="text-red-500">{sub.playerOutId?.name || sub.playerOutId || 'Unknown'}</span>
                    <span className="text-slate-400 dark:text-gray-500">→</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{sub.playerInId?.name || sub.playerInId || 'Unknown'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No data fallback */}
          {!footballData && (
            <div className="bg-white dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-800/60 rounded-2xl border border-slate-200 dark:border-gray-700/60 overflow-hidden shadow-sm">
              {(match.status === 'upcoming' || match.status === 'scheduled') ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mb-5">
                    <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-900 dark:text-white text-lg font-bold tracking-tight mb-2">Match Starting Soon</p>
                  <p className="text-slate-500 dark:text-gray-400 text-sm mb-6 max-w-sm">
                    This match hasn't started yet. Stay tuned for live updates!
                  </p>
                  {match.date && (
                    <div className="inline-flex items-center gap-3 bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700/60 rounded-xl px-5 py-3">
                      <div className="text-center">
                        <p className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wider font-medium">Scheduled</p>
                        <p className="text-slate-900 dark:text-white font-bold text-lg mt-0.5">{dayjs(match.date).format('DD MMM YYYY')}</p>
                        <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">{dayjs(match.date).format('hh:mm A')}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 dark:text-gray-500">No match data available.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Badminton scorecard */}
      {sport === 'badminton' && liveData?.badmintonData && (
        <div className="space-y-4">
          {/* Current Game Score */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 text-white shadow-lg">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Game {liveData.badmintonData.currentGame} of 3</p>
            <div className="grid grid-cols-3 gap-6 items-center">
              <div className="text-center">
                <p className="text-5xl font-black mb-2">{liveData.badmintonData.team1Points ?? 0}</p>
                <p className="text-sm font-semibold text-gray-300">{match.team1Id?.name}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">vs</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-black mb-2">{liveData.badmintonData.team2Points ?? 0}</p>
                <p className="text-sm font-semibold text-gray-300">{match.team2Id?.name}</p>
              </div>
            </div>
          </div>

          {/* Match Winner - Show when match is completed */}
          {match.status === 'completed' && match.result?.winner && (() => {
            const winnerId = String(match.result.winner?._id || match.result.winner);
            const team1IdStr = String(match.team1Id?._id || match.team1Id);
            const winnerName = winnerId === team1IdStr ? match.team1Id?.name : match.team2Id?.name;
            return (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-200 dark:border-amber-700 rounded-2xl p-6">
                <div className="text-center">
                  <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold mb-2">MATCH WINNER</p>
                  <p className="text-3xl font-black text-amber-900 dark:text-amber-300 mb-2">
                    {winnerName}
                  </p>
                  {match.result.summary && (
                    <p className="text-sm text-amber-700 dark:text-amber-300">{match.result.summary}</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Games Won */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700 text-center">
              <p className="text-xs text-slate-400 dark:text-gray-400 uppercase tracking-wider mb-2">Games Won</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {gamesWonFor(match.team1Id?._id)}
              </p>
              <p className="text-sm font-semibold text-slate-700 dark:text-gray-300 mt-1">{match.team1Id?.name}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700 text-center">
              <p className="text-xs text-slate-400 dark:text-gray-400 uppercase tracking-wider mb-2">Games Won</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {gamesWonFor(match.team2Id?._id)}
              </p>
              <p className="text-sm font-semibold text-slate-700 dark:text-gray-300 mt-1">{match.team2Id?.name}</p>
            </div>
          </div>

          {/* Match Summary Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50">
              <h3 className="text-slate-900 dark:text-white font-semibold">Match Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/30">
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Games Won</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Current Game Points</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { teamId: match.team1Id, points: liveData.badmintonData.team1Points ?? 0, otherPoints: liveData.badmintonData.team2Points ?? 0 },
                    { teamId: match.team2Id, points: liveData.badmintonData.team2Points ?? 0, otherPoints: liveData.badmintonData.team1Points ?? 0 },
                  ].map(({ teamId, points, otherPoints }, rowIdx) => {
                    const isWinner = match.status === 'completed'
                      && String(match.result?.winner?._id || match.result?.winner) === String(teamId?._id);
                    const wonCurrentGame = hasWonGame(points, otherPoints);
                    return (
                      <tr key={rowIdx} className={`${rowIdx === 0 ? 'border-b border-slate-100 dark:border-gray-700' : ''} hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors`}>
                        <td className="px-6 py-4 text-slate-900 dark:text-white font-semibold">{teamId?.name}</td>
                        <td className="px-6 py-4 text-center text-slate-900 dark:text-white font-bold text-lg">
                          {gamesWonFor(teamId?._id)}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-900 dark:text-white font-bold">
                          {points}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isWinner ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                              Match Winner
                            </span>
                          ) : match.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 text-xs font-semibold px-3 py-1 rounded-full">
                              Finished
                            </span>
                          ) : wonCurrentGame ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
                              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                              Game Won
                            </span>
                          ) : match.status === 'live' ? (
                            <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold px-3 py-1 rounded-full">
                              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                              Playing
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-500 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Game History */}
          {liveData.badmintonData.gameHistory && liveData.badmintonData.gameHistory.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50">
                <h3 className="text-slate-900 dark:text-white font-semibold">Game Results</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/30">
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Game</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">{match.team1Id?.name}</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">{match.team2Id?.name}</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveData.badmintonData.gameHistory.map((game, idx) => (
                      <tr key={idx} className="border-b border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Game {game.gameNumber}</td>
                        <td className="px-6 py-4 text-center text-slate-900 dark:text-white font-bold">{game.team1Points}</td>
                        <td className="px-6 py-4 text-center text-slate-900 dark:text-white font-bold">{game.team2Points}</td>
                        <td className="px-6 py-4 text-center">
                          {game.winner ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
                              {String(game.winner?._id || game.winner) === String(match.team1Id?._id) ? match.team1Id?.name : match.team2Id?.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-500 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Badminton - Completed match fallback from match.result.scores
          (covers matches where the live-scoring doc is gone or was never created) */}
      {sport === 'badminton' && !liveData?.badmintonData && match.status === 'completed' && Array.isArray(match.result?.scores) && match.result.scores.length > 0 && (
        <div className="space-y-4">
          {/* Winner banner */}
          {match.result?.winner && (() => {
            const winnerId = String(match.result.winner?._id || match.result.winner);
            const t1Id = String(match.team1Id?._id || match.team1Id);
            const winnerName = winnerId === t1Id ? match.team1Id?.name : match.team2Id?.name;
            return (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-200 dark:border-amber-700 rounded-2xl p-6">
                <div className="text-center">
                  <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold mb-2">MATCH WINNER</p>
                  <p className="text-3xl font-black text-amber-900 dark:text-amber-300 mb-2">{winnerName}</p>
                  {match.result.summary && (
                    <p className="text-sm text-amber-700 dark:text-amber-300">{match.result.summary}</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Game-by-game scores */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50">
              <h3 className="text-slate-900 dark:text-white font-semibold">Game Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/30">
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Game</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">{match.team1Id?.name}</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">{match.team2Id?.name}</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {match.result.scores.map((game, idx) => {
                    const t1Id = String(match.team1Id?._id || match.team1Id);
                    const winnerId = String(game.winner?._id || game.winner || '');
                    const winnerName = winnerId
                      ? (winnerId === t1Id ? match.team1Id?.name : match.team2Id?.name)
                      : null;
                    return (
                      <tr key={idx} className="border-b border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Game {game.gameNumber ?? idx + 1}</td>
                        <td className="px-6 py-4 text-center text-slate-900 dark:text-white font-bold">{game.team1Points}</td>
                        <td className="px-6 py-4 text-center text-slate-900 dark:text-white font-bold">{game.team2Points}</td>
                        <td className="px-6 py-4 text-center">
                          {winnerName ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full">
                              {winnerName}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-500 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Badminton - No data */}
      {sport === 'badminton' && !liveData?.badmintonData && !(match.status === 'completed' && Array.isArray(match.result?.scores) && match.result.scores.length > 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700/60 overflow-hidden shadow-sm">
          {(match.status === 'upcoming' || match.status === 'scheduled') ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-900 dark:text-white text-lg font-bold tracking-tight mb-2">Match Starting Soon</p>
              <p className="text-slate-500 dark:text-gray-400 text-sm mb-6 max-w-sm">
                This match hasn't started yet. Stay tuned for live updates!
              </p>
              {match.date && (
                <div className="inline-flex items-center gap-3 bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-700/60 rounded-xl px-5 py-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 dark:text-gray-500 uppercase tracking-wider font-medium">Scheduled</p>
                    <p className="text-slate-900 dark:text-white font-bold text-lg mt-0.5">{dayjs(match.date).format('DD MMM YYYY')}</p>
                    <p className="text-emerald-600 dark:text-emerald-400 font-semibold text-sm">{dayjs(match.date).format('hh:mm A')}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 dark:text-gray-500">Match data not available.</div>
          )}
        </div>
      )}
    </div>
  );
}
