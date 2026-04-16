import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { liveScoreSocket } from '../services/socket';
import dayjs from 'dayjs';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { MapPin, Calendar } from '../components/ui/Icons';

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
    queryFn: () => api.get(`/livescores/${id}`).then((r) => r.data),
    enabled: !!id,
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
    return () => {
      liveScoreSocket.emit('leave-match', id);
      liveScoreSocket.off('ball-update', handleSocketEvent);
      liveScoreSocket.off('wicket', handleSocketEvent);
      liveScoreSocket.off('innings-end', handleSocketEvent);
      liveScoreSocket.off('match-end', handleSocketEvent);
      liveScoreSocket.off('football-event', handleSocketEvent);
      liveScoreSocket.disconnect();
    };
  }, [id, handleSocketEvent]);

  useEffect(() => {
    if (livescoreData) setLiveData(livescoreData);
  }, [livescoreData]);

  if (isLoading) {
    return <Spinner />;
  }

  if (!match) {
    return <p className="text-slate-500 dark:text-gray-400 text-center py-16">Match not found.</p>;
  }

  const sport = match?.tournamentId?.sport || 'cricket';
  const innings = liveData?.innings || [];
  const footballData = liveData?.footballData || null;

  const halfLabel = {
    not_started: 'Not Started',
    '1st': '1st Half',
    half_time: 'Half Time',
    '2nd': '2nd Half',
    full_time: 'Full Time',
  };

  return (
    <div className="space-y-6">
      {/* Match header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-slate-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <StatusBadge status={match.status} />
          {match.tournamentId && (
            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">{match.tournamentId?.name || match.tournamentId}</span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="flex-1">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{match.team1Id?.name || 'Team A'}</p>
          </div>
          <div className="text-slate-400 dark:text-gray-500 font-bold text-lg px-4">VS</div>
          <div className="flex-1 text-right">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{match.team2Id?.name || 'Team B'}</p>
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
    </div>
  );
}
