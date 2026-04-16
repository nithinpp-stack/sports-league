import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

function StatBox({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
      <p className="text-2xl font-bold text-gray-900">{value ?? '--'}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

const matchStatusColor = {
  upcoming: 'bg-blue-50 text-blue-700',
  live: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-50 text-red-600',
};

export default function ViewPlayerModal({ playerId, tournamentId, onClose }) {
  const { data: viewingPlayerData } = useQuery({
    queryKey: ['player-detail', playerId],
    queryFn: () => api.get(`/players/${playerId}`).then((r) => r.data),
    enabled: !!playerId,
  });
  const viewingPlayer = viewingPlayerData?.data?.player || viewingPlayerData?.player || viewingPlayerData;

  const { data: playerLiveStatsData } = useQuery({
    queryKey: ['player-live-stats', playerId, tournamentId],
    queryFn: () => api.get(`/players/${playerId}/stats?tournamentId=${tournamentId}`).then((r) => r.data),
    enabled: !!playerId,
  });

  const { data: playerMatchesData } = useQuery({
    queryKey: ['player-matches', tournamentId],
    queryFn: () => api.get(`/matches?tournamentId=${tournamentId}`).then((r) => r.data),
    enabled: !!playerId,
  });

  if (!viewingPlayer) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-[dialogIn_0.15s_ease-out] p-10 text-center">
          <p className="text-sm text-gray-400">Loading player details...</p>
        </div>
      </div>
    );
  }

  const sport = viewingPlayer?.sport || viewingPlayer?.tournamentId?.sport || 'cricket';
  const liveStats = playerLiveStatsData?.stats || playerLiveStatsData?.data?.stats;
  const staticStats = viewingPlayer?.stats;
  const hasStaticStats = staticStats && (staticStats.matches > 0 || staticStats.runs > 0 || staticStats.wickets > 0);
  const cs = (liveStats?.matches > 0 ? liveStats : null) || (hasStaticStats ? staticStats : null);
  const fs = viewingPlayer?.footballStats;

  const playerTeamId = viewingPlayer?.teamId?._id || viewingPlayer?.teamId;
  const allMatches = Array.isArray(playerMatchesData)
    ? playerMatchesData
    : (playerMatchesData?.data?.matches || playerMatchesData?.matches) ?? [];
  const relevantMatches = allMatches.filter((m) => {
    const t1 = m.team1Id?._id || m.team1Id;
    const t2 = m.team2Id?._id || m.team2Id;
    return (
      (t1 && playerTeamId && t1.toString() === playerTeamId.toString()) ||
      (t2 && playerTeamId && t2.toString() === playerTeamId.toString())
    );
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-[dialogIn_0.15s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-0">
          <h3 className="text-lg font-semibold text-gray-900">Player Details</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[85vh] px-10 pb-10 pt-8 space-y-8">
          {/* Identity section */}
          <div className="flex items-start gap-5">
            {viewingPlayer.photo ? (
              <img
                src={`${import.meta.env.VITE_API_URL || ''}${viewingPlayer.photo}`}
                alt=""
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-2xl font-bold text-gray-500 border-2 border-gray-200 shadow-sm shrink-0">
                {viewingPlayer.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-gray-900">{viewingPlayer.name}</p>
              <p className="text-sm text-gray-500 capitalize mt-0.5">
                {viewingPlayer.skill?.replace(/[-_]/g, ' ')}
                {viewingPlayer.age ? ` \u2022 Age ${viewingPlayer.age}` : ''}
              </p>
              <div className="mt-2 space-y-0.5 text-sm text-gray-600">
                {viewingPlayer.teamId?.name && (
                  <p><span className="text-gray-400 text-xs uppercase tracking-wide">Team</span> <span className="font-medium ml-1">{viewingPlayer.teamId.name}</span></p>
                )}
                {(viewingPlayer.tournamentId?.name || viewingPlayer.tournamentId) && (
                  <p><span className="text-gray-400 text-xs uppercase tracking-wide">Tournament</span> <span className="font-medium ml-1">{viewingPlayer.tournamentId?.name || '\u2014'}</span></p>
                )}
                {viewingPlayer.phone && (
                  <p><span className="text-gray-400 text-xs uppercase tracking-wide">Phone</span> <span className="font-medium ml-1">{viewingPlayer.phone}</span></p>
                )}
                {viewingPlayer.address && (
                  <p><span className="text-gray-400 text-xs uppercase tracking-wide">Address</span> <span className="font-medium ml-1">{viewingPlayer.address}</span></p>
                )}
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
              viewingPlayer.status === 'sold' ? 'bg-emerald-50 text-emerald-700' :
              viewingPlayer.status === 'available' ? 'bg-gray-100 text-gray-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              {viewingPlayer.status}
            </span>
          </div>

          {/* Career Statistics */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Career Statistics</p>
            {sport === 'football' && fs ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Matches" value={fs.matches} />
                  <StatBox label="Goals" value={fs.goals} />
                  <StatBox label="Assists" value={fs.assists} />
                  <StatBox label="Yellow Cards" value={fs.yellowCards} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="Red Cards" value={fs.redCards} />
                  <StatBox label="Clean Sheets" value={fs.cleanSheets} />
                  <StatBox label="Minutes Played" value={fs.minutesPlayed} />
                </div>
              </div>
            ) : cs ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Matches" value={cs.matches} />
                  <StatBox label="Runs" value={cs.runs} />
                  <StatBox label="Wickets" value={cs.wickets} />
                  <StatBox label="Catches" value={cs.catches} />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Highest" value={cs.highestScore} />
                  <StatBox label="Average" value={cs.average != null ? (typeof cs.average === 'number' ? cs.average.toFixed(2) : cs.average) : '\u2014'} />
                  <StatBox label="Strike Rate" value={cs.strikeRate != null ? (typeof cs.strikeRate === 'number' ? cs.strikeRate.toFixed(1) : cs.strikeRate) : '\u2014'} />
                  <StatBox label="Economy" value={cs.economyRate != null ? (typeof cs.economyRate === 'number' ? cs.economyRate.toFixed(2) : cs.economyRate) : '\u2014'} />
                </div>
                {cs.bestBowling && cs.bestBowling !== '0/0' && (
                  <p className="text-sm text-gray-600">
                    <span className="text-gray-400 text-xs uppercase tracking-wide">Best Bowling</span>
                    <span className="font-semibold ml-2">{cs.bestBowling}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No stats recorded yet.</p>
            )}
          </div>

          {/* Matches section */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Matches {relevantMatches.length > 0 && <span className="text-gray-300">({relevantMatches.length})</span>}
            </p>
            {relevantMatches.length > 0 ? (
              <div className="space-y-2">
                {relevantMatches.map((m) => (
                  <div key={m._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {m.team1Id?.name || 'Team 1'} <span className="text-gray-400 font-normal">vs</span> {m.team2Id?.name || 'Team 2'}
                      </p>
                      {m.venue && <p className="text-xs text-gray-400 mt-0.5">{m.venue}</p>}
                      {m.result?.summary && <p className="text-xs text-gray-500 mt-0.5">{m.result.summary}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-3 ${matchStatusColor[m.status] || 'bg-gray-100 text-gray-500'}`}>
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                {playerTeamId ? "No matches found for this player's team." : 'Player is not assigned to a team yet.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
