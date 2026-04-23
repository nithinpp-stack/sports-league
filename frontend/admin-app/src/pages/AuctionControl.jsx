import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { auctionSocket } from '../services/socket';
import { useConfirm } from '../components/ui/ConfirmModal';

export default function AuctionControl() {
  const { tournamentId } = useParams();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [auctionState, setAuctionState] = useState(null);
  const [teamsState, setTeamsState] = useState([]);
  const [bidHistory, setBidHistory] = useState([]);

  const { data: auctionData, isLoading } = useQuery({
    queryKey: ['auction', tournamentId],
    queryFn: () => api.get(`/auctions/${tournamentId}`).then((r) => r.data),
    retry: false,
  });

  const { data: teamsData } = useQuery({
    queryKey: ['tournament-teams', tournamentId],
    queryFn: () => api.get(`/tournaments/${tournamentId}/teams`).then((r) => r.data),
    enabled: !!tournamentId,
  });

  const { data: recentBidsData } = useQuery({
    queryKey: ['recent-bids', tournamentId],
    queryFn: () =>
      auctionState?.data?._id
        ? api.get(`/bids?auctionId=${auctionState.data._id}&limit=10`).then((r) => r.data)
        : Promise.resolve(null),
    enabled: false,
  });

  // Connect to socket
  useEffect(() => {
    auctionSocket.connect();
    auctionSocket.emit('join-auction', tournamentId);

    const handleUpdate = (data) => {
      setAuctionState(data);
      qc.invalidateQueries(['auction', tournamentId]);
      qc.invalidateQueries(['tournament-teams', tournamentId]);
    };

    const handleNewBid = (data) => {
      handleUpdate(data);
      setBidHistory((prev) => [{ ...data, timestamp: new Date() }, ...prev].slice(0, 20));
    };

    auctionSocket.on('auction-update', handleUpdate);
    auctionSocket.on('new-bid', handleNewBid);
    auctionSocket.on('new-player', handleUpdate);
    auctionSocket.on('player-sold', () => {
      qc.invalidateQueries(['auction', tournamentId]);
      qc.invalidateQueries(['tournament-teams', tournamentId]);
    });
    auctionSocket.on('player-unsold', () => qc.invalidateQueries(['auction', tournamentId]));
    auctionSocket.on('going-once', (data) => {
      qc.invalidateQueries(['auction', tournamentId]);
    });
    auctionSocket.on('going-twice', (data) => {
      qc.invalidateQueries(['auction', tournamentId]);
    });
    auctionSocket.on('set-changed', () => qc.invalidateQueries(['auction', tournamentId]));
    auctionSocket.on('auction-error', (err) => {
      toast.error(err.message || 'Auction error');
    });

    return () => {
      auctionSocket.off('auction-update');
      auctionSocket.off('new-bid', handleNewBid);
      auctionSocket.off('new-player');
      auctionSocket.off('player-sold');
      auctionSocket.off('player-unsold');
      auctionSocket.off('going-once');
      auctionSocket.off('going-twice');
      auctionSocket.off('set-changed');
      auctionSocket.off('auction-error');
      auctionSocket.disconnect();
    };
  }, [tournamentId]);

  useEffect(() => {
    if (auctionData) {
      setAuctionState(auctionData);
    }
  }, [auctionData]);

  useEffect(() => {
    if (teamsData) {
      const list = Array.isArray(teamsData) ? teamsData : teamsData?.teams ?? [];
      setTeamsState(list);
    }
  }, [teamsData]);

  const startMutation = useMutation({
    mutationFn: () => api.post(`/auctions/${tournamentId}/start`),
    onSuccess: () => {
      toast.success('Auction started!');
      qc.invalidateQueries(['auction', tournamentId]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to start auction'),
  });

  const controlMutation = useMutation({
    mutationFn: ({ action, payload }) => api.post(`/auctions/${tournamentId}/${action}`, payload ?? {}),
    onSuccess: (res, { action }) => {
      const labels = {
        'next-player': 'Next player set!',
        sell: 'Player sold!',
        unsold: 'Marked unsold.',
        pause: 'Auction paused.',
        resume: 'Auction resumed.',
        end: 'Auction ended.',
        'going-once': 'Going once!',
        'going-twice': 'Going twice!',
      };
      toast.success(labels[action] ?? `Action "${action}" successful!`);
      // The end-auction response carries a `warnings.undersizedTeams[]` list
      // (teams that finished below minSquadSize). Surface it as a long-lived
      // warning toast so the admin doesn't miss it after the auction closes.
      if (action === 'end') {
        const warnings = res?.data?.data?.warnings ?? res?.data?.warnings;
        const under = warnings?.undersizedTeams ?? [];
        if (under.length) {
          toast(
            `${under.length} team${under.length > 1 ? 's' : ''} finished undersized: ${under
              .map((t) => `${t.name} (${t.playerCount})`)
              .join(', ')}`,
            { icon: '⚠️', duration: 8000 }
          );
        }
      }
      qc.invalidateQueries(['auction', tournamentId]);
      qc.invalidateQueries(['tournament-teams', tournamentId]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Action failed'),
  });

  const changeSetMutation = useMutation({
    mutationFn: (setName) => api.post(`/auctions/${tournamentId}/change-set`, { setName }),
    onSuccess: () => {
      toast.success('Set changed!');
      qc.invalidateQueries(['auction', tournamentId]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to change set'),
  });

  // Restart = wipe the current auction doc + flip any 'unsold' players back to
  // 'available' so the next startAuction repools them. This is the admin's way
  // out of a stuck/completed auction when new players have been added since.
  const resetMutation = useMutation({
    mutationFn: () => api.post(`/auctions/${tournamentId}/reset`),
    onSuccess: (res) => {
      const reopened = res?.data?.data?.reopenedPlayers ?? 0;
      toast.success(
        reopened > 0
          ? `Auction reset. ${reopened} unsold player${reopened > 1 ? 's' : ''} returned to pool.`
          : 'Auction reset. Click Start Auction to repool.'
      );
      setAuctionState(null); // clear stale socket state so isNoAuction flips true
      qc.invalidateQueries(['auction', tournamentId]);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to reset auction'),
  });

  const handleRestart = async () => {
    const ok = await confirm('Restart the auction?', {
      description:
        'This deletes the current auction and returns any unsold players to the pool. Sold players stay on their teams. You can then click Start Auction to repool all available players.',
      confirmText: 'Restart',
      variant: 'danger',
    });
    if (ok) resetMutation.mutate();
  };

  const auction = auctionState?.data ?? auctionState;
  const isNoAuction = !isLoading && !auction;
  const currentPlayer = auction?.currentPlayerId;
  const currentBidder = auction?.currentBidderId;
  const soldPlayers = auction?.soldPlayers ?? [];
  const remainingCount = auction?.remainingPlayers?.length ?? 0;
  const unsoldCount = auction?.unsoldPlayers?.length ?? 0;
  const playerSets = auction?.playerSets ?? [];
  const currentSet = auction?.currentSet ?? '';
  const bidIncrement = auction?.bidIncrement ?? 5;
  const goingOnce = auction?.goingOnce ?? false;
  const goingTwice = auction?.goingTwice ?? false;
  const maxSquadSize = auction?.maxSquadSize ?? 15;
  const minSquadSize = auction?.minSquadSize ?? 11;

  // Per-set progress — how many players in the current set still haven't been
  // called. We intersect the set's playerIds with remainingPlayers so the
  // counter reflects live state (a sold/unsold player in this set drops off).
  const remainingIdSet = new Set((auction?.remainingPlayers ?? []).map((p) => String(p?._id ?? p)));
  const currentSetObj = playerSets.find((s) => s.name === currentSet);
  const currentSetTotal = currentSetObj?.playerIds?.length ?? 0;
  const currentSetRemaining = (currentSetObj?.playerIds ?? []).filter((pid) =>
    remainingIdSet.has(String(pid?._id ?? pid))
  ).length;

  // Live undersized-team detection. Matches the server-side check in
  // endAuction so the admin sees the warning BEFORE they hit End Auction,
  // not as a post-close surprise. Empty squads are excluded (a team that
  // hasn't bought anyone yet may not be participating at all).
  const undersizedTeams = teamsState.filter(
    (t) => (t.playerCount ?? 0) > 0 && (t.playerCount ?? 0) < minSquadSize
  );

  // Going-once/twice status label
  const goingStatusLabel = goingTwice
    ? 'GOING TWICE!'
    : goingOnce
    ? 'GOING ONCE!'
    : null;

  const goingStatusColor = goingTwice
    ? 'bg-orange-500 text-white'
    : goingOnce
    ? 'bg-yellow-400 text-yellow-900'
    : '';

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-800">Auction Control</h2>

      {isLoading && <p className="text-gray-400">Loading auction...</p>}

      {/* Start auction */}
      {isNoAuction && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600 mb-4">No auction exists for this tournament yet.</p>
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            {startMutation.isPending ? 'Starting...' : 'Start Auction'}
          </button>
        </div>
      )}

      {auction && (
        <>
          {/* Header: Status + Set Selector */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                    <p className="text-lg font-semibold text-gray-800 capitalize">{auction.status ?? '—'}</p>
                  </div>
                  {currentSet && (
                    <div className="ml-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Current Set</p>
                      <p className="text-lg font-semibold text-indigo-600">{currentSet}</p>
                      {currentSetTotal > 0 && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Remaining in set: <span className="font-semibold text-gray-600">{currentSetRemaining}</span>
                          <span className="text-gray-300"> / {currentSetTotal}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Set selector buttons */}
                {playerSets.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {playerSets.map((set) => (
                      <button
                        key={set.name}
                        onClick={() => changeSetMutation.mutate(set.name)}
                        disabled={changeSetMutation.isPending}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                          currentSet === set.name
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                        }`}
                      >
                        {set.name} ({set.playerIds?.length ?? 0})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Auction controls */}
              <div className="flex flex-wrap gap-2">
                {auction.status === 'live' && (
                  <button
                    onClick={() => controlMutation.mutate({ action: 'pause' })}
                    disabled={controlMutation.isPending}
                    className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-60"
                  >
                    Pause
                  </button>
                )}
                {auction.status === 'paused' && (
                  <button
                    onClick={() => controlMutation.mutate({ action: 'resume' })}
                    disabled={controlMutation.isPending}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-60"
                  >
                    Resume
                  </button>
                )}
                {/* Next Player / End Auction only make sense while the auction
                    is still open. A 'completed' auction has no pool to draw
                    from and no state left to close — showing these buttons
                    just leads to confused clicks and 400 responses. */}
                {auction.status !== 'completed' && (
                  <>
                    <button
                      onClick={() => controlMutation.mutate({ action: 'next-player' })}
                      disabled={controlMutation.isPending}
                      className="px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
                    >
                      Next Player
                    </button>
                    <button
                      onClick={() => controlMutation.mutate({ action: 'end' })}
                      disabled={controlMutation.isPending}
                      className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-900 transition-colors disabled:opacity-60"
                    >
                      End Auction
                    </button>
                  </>
                )}
                {/* Restart — only surfaces on completed auctions. It deletes
                    the current auction doc (backing the Start Auction button
                    to re-appear) and returns unsold players to the pool, so
                    newly-added players come along on the next start. */}
                {auction.status === 'completed' && (
                  <button
                    onClick={handleRestart}
                    disabled={resetMutation.isPending}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  >
                    {resetMutation.isPending ? 'Restarting...' : 'Restart Auction'}
                  </button>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-600">
              <span>Remaining: <strong>{remainingCount}</strong></span>
              <span>Unsold: <strong>{unsoldCount}</strong></span>
              <span>Sold: <strong>{soldPlayers.length}</strong></span>
              <span>Max Squad: <strong>{maxSquadSize}</strong></span>
              <span>Min Squad: <strong>{minSquadSize}</strong></span>
            </div>

            {/* Undersized-teams warning — shows live while the auction is
                still open so the admin can prioritise those teams before
                closing. The server runs the same check on endAuction as a
                safety net, but this banner is the primary nudge. */}
            {auction.status !== 'completed' && undersizedTeams.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 text-lg leading-none mt-0.5">⚠</span>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-amber-800">
                      {undersizedTeams.length} team{undersizedTeams.length > 1 ? 's' : ''} below
                      minimum squad size ({minSquadSize})
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {undersizedTeams.map((t) => (
                        <span
                          key={t._id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-amber-200 text-xs text-amber-700"
                        >
                          {t.name}
                          <span className="text-amber-500 font-mono">
                            {t.playerCount ?? 0}/{minSquadSize}
                          </span>
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-amber-700/80 mt-1.5">
                      Ending the auction now will surface these as warnings.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Current Player Card */}
          {currentPlayer && (
            <div
              className={`rounded-xl shadow-sm p-6 border-2 transition-all ${
                goingTwice
                  ? 'bg-orange-50 border-orange-400'
                  : goingOnce
                  ? 'bg-yellow-50 border-yellow-400'
                  : 'bg-white border-transparent'
              }`}
            >
              {/* Player Profile */}
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Photo */}
                <div className="shrink-0">
                  {currentPlayer.photo ? (
                    <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${currentPlayer.photo}`} alt="" className="w-24 h-24 rounded-2xl object-cover border-2 border-gray-100 shadow-md" />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-100 to-gray-100 flex items-center justify-center text-3xl font-bold text-emerald-500 border-2 border-gray-100 shadow-md">
                      {currentPlayer.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">Current Player</p>
                  <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{currentPlayer.name ?? '—'}</p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full capitalize border border-emerald-200">
                      {currentPlayer.skill?.replace(/_/g, ' ') || '—'}
                    </span>
                    <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-full border border-gray-200">
                      Base: {currentPlayer.basePoints ?? '—'} pts
                    </span>
                  </div>
                </div>

                {/* Bid */}
                <div className="text-center sm:text-right shrink-0">
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Current Bid</p>
                  <p className="text-4xl font-black text-emerald-600 tracking-tight mt-1">
                    {auction.currentBid?.toLocaleString() ?? '—'}
                    <span className="text-lg font-semibold text-gray-400 ml-1">pts</span>
                  </p>
                  {currentBidder && (
                    <p className="text-sm text-gray-500 mt-1">
                      by <span className="font-semibold text-gray-800">{currentBidder.name ?? String(currentBidder)}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Going once / twice visual indicator */}
              {goingStatusLabel && (
                <div className={`mt-5 text-center py-3 rounded-xl font-extrabold text-xl tracking-widest animate-pulse ${goingStatusColor}`}>
                  {goingStatusLabel}
                </div>
              )}

              {/* Bid action buttons */}
              <div className="mt-5 flex flex-wrap gap-3 pt-5 border-t border-gray-100">
                {!goingOnce && currentBidder && (
                  <button
                    onClick={() => controlMutation.mutate({ action: 'going-once' })}
                    disabled={controlMutation.isPending}
                    className="px-6 py-2.5 bg-amber-400 text-amber-900 text-sm font-bold rounded-xl hover:bg-amber-500 transition-colors disabled:opacity-60 shadow-sm"
                  >
                    Going Once!
                  </button>
                )}
                {goingOnce && !goingTwice && (
                  <button
                    onClick={() => controlMutation.mutate({ action: 'going-twice' })}
                    disabled={controlMutation.isPending}
                    className="px-6 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-60 shadow-sm"
                  >
                    Going Twice!
                  </button>
                )}
                {currentBidder && (
                  <button
                    onClick={() => controlMutation.mutate({ action: 'sell' })}
                    disabled={controlMutation.isPending}
                    className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 shadow-sm"
                  >
                    SOLD!
                  </button>
                )}
                <button
                  onClick={() => controlMutation.mutate({ action: 'unsold' })}
                  disabled={controlMutation.isPending}
                  className="px-6 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60 shadow-sm"
                >
                  Unsold
                </button>
              </div>
            </div>
          )}

          {/* Live Bid Feed */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-700">Live Bid Feed</h3>
            </div>
            <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
              {bidHistory.map((bid, i) => {
                // The server only ships `teamId` in the new-bid socket payload
                // so we resolve the display name from the already-loaded teams
                // list. Falls back to `teamName` if a future emit includes it,
                // then to a truncated id, then a generic label.
                const team = teamsState.find((t) => String(t._id) === String(bid.teamId));
                const label =
                  team?.name ||
                  bid.teamName ||
                  (bid.teamId ? `Team ${String(bid.teamId).slice(-4)}` : 'Team');
                return (
                  <div key={i} className="px-5 py-2.5 flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-900">{label}</span>
                    <span className="font-bold text-emerald-600">{bid.amount} pts</span>
                    <span className="text-xs text-gray-400">
                      {bid.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                );
              })}
              {bidHistory.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400">No bids yet...</p>
              )}
            </div>
          </div>

          {/* Team Points Display */}
          {teamsState.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Team Points</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teamsState.map((team) => {
                  const totalPts = team.totalPoints ?? team.budget ?? 1000;
                  const remainingPts = team.remainingPoints ?? team.remainingBudget ?? totalPts;
                  const squadCount = team.playerCount ?? 0;
                  const pctUsed = totalPts > 0 ? Math.round(((totalPts - remainingPts) / totalPts) * 100) : 0;
                  return (
                    <div key={team._id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="font-semibold text-gray-800 text-sm">{team.name}</p>
                      <p className="text-emerald-600 font-bold text-lg mt-0.5">
                        {remainingPts?.toLocaleString()} pts
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500">
                          Squad: <span className="font-medium text-gray-700">{squadCount}/{maxSquadSize}</span>
                        </p>
                        <p className="text-xs text-gray-400">{pctUsed}% used</p>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pctUsed}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sold players / Bidding log */}
          {soldPlayers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                Sold Players <span className="text-gray-400 font-normal text-sm">({soldPlayers.length})</span>
              </h3>
              <ul className="space-y-2">
                {soldPlayers.slice().reverse().map((sp, i) => (
                  <li
                    key={sp._id ?? i}
                    className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium text-gray-800">{sp.playerId?.name ?? '—'}</span>
                    <div className="text-right flex items-center gap-3">
                      <span className="text-emerald-600 font-semibold">{sp.amount?.toLocaleString() ?? '—'} pts</span>
                      {sp.teamId && (
                        <span className="text-gray-500 text-xs">
                          &rarr; {sp.teamId?.name ?? String(sp.teamId)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
