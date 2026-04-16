import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';
import { auctionSocket } from '../services/socket';

export default function AuctionControl() {
  const { tournamentId } = useParams();
  const qc = useQueryClient();
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
    onSuccess: (_, { action }) => {
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
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-600">
              <span>Remaining: <strong>{remainingCount}</strong></span>
              <span>Unsold: <strong>{unsoldCount}</strong></span>
              <span>Sold: <strong>{soldPlayers.length}</strong></span>
              <span>Max Squad: <strong>{maxSquadSize}</strong></span>
            </div>
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Player</h3>
                  <p className="text-2xl font-bold text-gray-900">{currentPlayer.name ?? '—'}</p>
                  <p className="text-sm text-gray-500 capitalize mt-0.5">
                    {currentPlayer.skill?.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Base pts: <span className="font-semibold text-gray-600">{currentPlayer.basePoints ?? '—'} pts</span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Current Bid</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {auction.currentBid?.toLocaleString() ?? '—'} pts
                  </p>
                  {currentBidder && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      by <span className="font-medium text-gray-700">{currentBidder.name ?? String(currentBidder)}</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Min increment: <span className="font-semibold">+{bidIncrement} pts</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Next min bid: <span className="font-semibold text-indigo-600">{(auction.currentBid ?? 0) + bidIncrement} pts</span>
                  </p>
                </div>
              </div>

              {/* Going once / twice visual indicator */}
              {goingStatusLabel && (
                <div className={`mt-4 text-center py-2 rounded-lg font-bold text-lg tracking-widest animate-pulse ${goingStatusColor}`}>
                  {goingStatusLabel}
                </div>
              )}

              {/* Bid action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                {!goingOnce && currentBidder && (
                  <button
                    onClick={() => controlMutation.mutate({ action: 'going-once' })}
                    disabled={controlMutation.isPending}
                    className="px-5 py-2 bg-yellow-400 text-yellow-900 text-sm font-bold rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-60"
                  >
                    Going Once!
                  </button>
                )}
                {goingOnce && !goingTwice && (
                  <button
                    onClick={() => controlMutation.mutate({ action: 'going-twice' })}
                    disabled={controlMutation.isPending}
                    className="px-5 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-60"
                  >
                    Going Twice!
                  </button>
                )}
                {currentBidder && (
                  <button
                    onClick={() => controlMutation.mutate({ action: 'sell' })}
                    disabled={controlMutation.isPending}
                    className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  >
                    SOLD!
                  </button>
                )}
                <button
                  onClick={() => controlMutation.mutate({ action: 'unsold' })}
                  disabled={controlMutation.isPending}
                  className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
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
              {bidHistory.map((bid, i) => (
                <div key={i} className="px-5 py-2.5 flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-900">{bid.teamName || 'Team'}</span>
                  <span className="font-bold text-emerald-600">{bid.amount} pts</span>
                  <span className="text-xs text-gray-400">
                    {bid.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
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
