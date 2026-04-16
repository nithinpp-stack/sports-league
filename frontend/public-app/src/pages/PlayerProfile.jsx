import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import dayjs from 'dayjs';
import Spinner from '../components/ui/Spinner';
import { Trophy, Calendar } from '../components/ui/Icons';

function StatCard({ label, value, accent = false }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${
      accent
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800'
    }`}>
      <p className={`text-3xl font-bold tracking-tight ${accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
        {value ?? '--'}
      </p>
      <p className="text-sm text-slate-500 dark:text-gray-400 mt-1.5 font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}

export default function PlayerProfile() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['player', id],
    queryFn: () => api.get(`/players/${id}`).then((r) => r.data?.player || r.data),
  });

  const tournamentId = data?.tournamentId?._id || data?.tournamentId;
  const { data: liveStatsData } = useQuery({
    queryKey: ['player-live-stats', id, tournamentId],
    queryFn: () => api.get(`/players/${id}/stats${tournamentId ? `?tournamentId=${tournamentId}` : ''}`).then((r) => r.data?.stats || r.data),
    enabled: !!id,
  });

  const { data: matchHistoryData } = useQuery({
    queryKey: ['player-matches', id],
    queryFn: () => api.get(`/players/${id}/matches`).then((r) => r.data?.matches || []),
    enabled: !!id,
  });

  const { data: achievementsData } = useQuery({
    queryKey: ['player-achievements', id],
    queryFn: () => api.get(`/players/${id}/achievements`).then((r) => r.data),
    enabled: !!id,
  });

  const matchHistory = matchHistoryData || [];

  const tournamentGroups = useMemo(() => {
    const map = new Map();
    matchHistory.forEach(m => {
      const tId = m.tournament?._id || 'unknown';
      if (!map.has(tId)) map.set(tId, { tournament: m.tournament, matches: [] });
      map.get(tId).matches.push(m);
    });
    return [...map.values()];
  }, [matchHistory]);

  const achievements = achievementsData || {};
  const totalAwards = (achievements.manOfMatch?.count || 0) + (achievements.bestBatsman?.count || 0) + (achievements.bestBowler?.count || 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-slate-500 dark:text-gray-400 text-center py-16">Player not found.</p>;
  }

  const player = data;
  const sport = player?.sport || player?.tournamentId?.sport || 'cricket';
  const liveStats = liveStatsData?.matches > 0 ? liveStatsData : null;
  const stats = liveStats || player.stats || {};
  const footballStats = player.footballStats || {};
  const photoUrl = player.photo ? `${import.meta.env.VITE_API_URL || ''}${player.photo}` : null;

  const cricketStats = [
    { label: 'Matches', value: stats.matches, accent: true },
    { label: 'Runs', value: stats.runs, accent: true },
    { label: 'Wickets', value: stats.wickets, accent: true },
    { label: 'Highest', value: stats.highestScore },
    { label: 'Average', value: stats.average },
    { label: 'Strike Rate', value: stats.strikeRate },
    { label: 'Economy', value: stats.economyRate },
    { label: 'Catches', value: stats.catches },
    ...(stats.bestBowling ? [{ label: 'Best Bowling', value: stats.bestBowling }] : []),
  ];

  const footballStatItems = [
    { label: 'Matches', value: footballStats.matches, accent: true },
    { label: 'Goals', value: footballStats.goals, accent: true },
    { label: 'Assists', value: footballStats.assists, accent: true },
    { label: 'Yellow Cards', value: footballStats.yellowCards },
    { label: 'Red Cards', value: footballStats.redCards },
    { label: 'Clean Sheets', value: footballStats.cleanSheets },
    { label: 'Minutes', value: footballStats.minutesPlayed },
  ];

  const activeStats = sport === 'football' ? footballStatItems : cricketStats;

  return (
    <div className="space-y-8">
      {/* Hero Profile Card */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {/* Background gradient */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-emerald-950/30" />
          <div
            className="absolute inset-0 opacity-5 dark:opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-white/80 dark:from-gray-900/90 to-transparent" />

          <div className="relative z-10 p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
              {/* Photo */}
              <div className="shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={player.name}
                    className="w-32 h-32 rounded-xl object-cover border border-slate-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-emerald-100 to-slate-100 dark:from-gray-700 dark:to-gray-800 border border-slate-200 dark:border-gray-700 flex items-center justify-center">
                    <span className="text-5xl font-bold text-emerald-400 dark:text-gray-500">
                      {player.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-3">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {player.name}
                  </h1>
                  {player.teamId?.name && (
                    <Link
                      to={`/teams/${player.teamId._id || player.teamId}`}
                      className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors duration-200 hover:bg-slate-200 dark:hover:bg-white/15"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {player.teamId.name}
                    </Link>
                  )}
                </div>

                <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-4">
                  {player.skill && (
                    <span className="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold capitalize tracking-wide">
                      {player.skill.replace(/[-_]/g, ' ')}
                    </span>
                  )}
                  {player.age && (
                    <span className="bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                      Age {player.age}
                    </span>
                  )}
                  <span className="bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-700 px-3 py-1 rounded-full text-xs font-medium capitalize">
                    {sport}
                  </span>
                </div>

                {sport === 'cricket' && (
                  <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-sm text-slate-500 dark:text-gray-400">
                    {player.battingStyle && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 dark:text-gray-500">Batting</span>
                        <span className="text-slate-700 dark:text-gray-300 font-medium capitalize">{player.battingStyle}</span>
                      </div>
                    )}
                    {player.bowlingStyle && player.bowlingStyle !== 'none' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 dark:text-gray-500">Bowling</span>
                        <span className="text-slate-700 dark:text-gray-300 font-medium capitalize">{player.bowlingStyle}</span>
                      </div>
                    )}
                  </div>
                )}

                {(player.phone || player.address) && (
                  <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-3 text-sm text-slate-500 dark:text-gray-400">
                    {player.phone && <span>{player.phone}</span>}
                    {player.address && <span>{player.address}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Career Statistics */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Career Statistics</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-gray-700 to-transparent" />
        </div>

        <div className={`grid gap-4 ${sport === 'football' ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7' : 'grid-cols-3 sm:grid-cols-5'}`}>
          {activeStats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
          ))}
        </div>
      </div>

      {/* Achievements */}
      {totalAwards > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Achievements</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-gray-700 to-transparent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { key: 'manOfMatch', label: 'Man of the Match', icon: '🏆', color: 'amber' },
              { key: 'bestBatsman', label: 'Best Batsman', icon: '🏏', color: 'emerald' },
              { key: 'bestBowler', label: 'Best Bowler', icon: '🎯', color: 'blue' },
            ].map(({ key, label, icon, color }) => {
              const award = achievements[key];
              if (!award?.count) return null;
              return (
                <div key={key} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{award.count}</p>
                      <p className="text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {award.matches.slice(0, 3).map(m => (
                      <Link key={m._id} to={`/matches/${m._id}`} className="block text-xs text-slate-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                        {m.team1?.name} vs {m.team2?.name}
                        {m.date && <span className="ml-1 text-slate-400 dark:text-gray-500">· {dayjs(m.date).format('DD MMM')}</span>}
                      </Link>
                    ))}
                    {award.count > 3 && <p className="text-xs text-slate-400 dark:text-gray-500">+{award.count - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tournament History */}
      {tournamentGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Tournament History</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-gray-700 to-transparent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournamentGroups.map(({ tournament, matches: tMatches }) => {
              const totalRuns = tMatches.reduce((s, m) => s + (m.batting?.runs || 0), 0);
              const totalWickets = tMatches.reduce((s, m) => s + (m.bowling?.wickets || 0), 0);
              const tAwards = tMatches.reduce((s, m) => s + (m.awards?.length || 0), 0);
              return (
                <Link
                  key={tournament?._id || 'unknown'}
                  to={`/tournaments/${tournament?._id}`}
                  className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-xl p-5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{tournament?.name || 'Tournament'}</p>
                      <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 capitalize">{tournament?.format} · {tournament?.sport}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      tournament?.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : tournament?.status === 'completed' ? 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400'
                      : 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400'
                    }`}>{tournament?.status || '—'}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{tMatches.length}</p>
                      <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">Matches</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{totalRuns}</p>
                      <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">Runs</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{totalWickets}</p>
                      <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">Wickets</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{tAwards}</p>
                      <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">Awards</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Match History */}
      {matchHistory.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Match History</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-gray-700 to-transparent" />
          </div>
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase">Match</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase">Tournament</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase">Batting</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase">Bowling</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 dark:text-gray-500 uppercase">Awards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {matchHistory.map(m => (
                    <tr key={m._id} className="hover:bg-slate-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/matches/${m._id}`} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                          <p className="font-medium text-slate-900 dark:text-white text-xs">
                            {m.team1?.name} vs {m.team2?.name}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-0.5">
                            {m.date ? dayjs(m.date).format('DD MMM YYYY') : '—'}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-gray-400">{m.tournament?.name || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {m.batting ? (
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{m.batting.runs}</span>
                            <span className="text-slate-400 dark:text-gray-500 text-xs"> ({m.batting.balls}b)</span>
                            {(m.batting.fours > 0 || m.batting.sixes > 0) && (
                              <p className="text-[10px] text-slate-400 dark:text-gray-500">{m.batting.fours}×4 {m.batting.sixes}×6</p>
                            )}
                          </div>
                        ) : <span className="text-slate-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.bowling ? (
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{m.bowling.wickets}/{m.bowling.runs}</span>
                            <p className="text-[10px] text-slate-400 dark:text-gray-500">({m.bowling.overs} ov)</p>
                          </div>
                        ) : <span className="text-slate-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.awards?.length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1">
                            {m.awards.map((a, i) => (
                              <span key={i} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                {a === 'Man of Match' ? 'MoM' : a === 'Best Batsman' ? 'Bat' : 'Bowl'}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-slate-300 dark:text-gray-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
