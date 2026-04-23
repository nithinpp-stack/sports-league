import React, { useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { auctionSocket } from '../services/socket';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { Gavel, Users } from '../components/ui/Icons';

export default function AuctionViewer() {
  const { tournamentId } = useParams();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auction', tournamentId],
    queryFn: () => api.get(`/auctions/${tournamentId}`).then((r) => r.data),
    enabled: !!tournamentId,
  });

  const { data: teamsData, refetch: refetchTeams } = useQuery({
    queryKey: ['tournament-teams', tournamentId],
    queryFn: () => api.get(`/tournaments/${tournamentId}/teams`).then((r) => r.data),
    enabled: !!tournamentId,
  });

  const handleAuctionEvent = useCallback(() => {
    refetch();
    refetchTeams();
  }, [refetch, refetchTeams]);

  useEffect(() => {
    auctionSocket.connect();
    auctionSocket.emit('join-auction', tournamentId);

    const events = [
      'auction-started', 'player-listed', 'bid-placed',
      'player-sold', 'player-unsold', 'auction-ended',
      'new-player', 'new-bid', 'going-once', 'going-twice', 'set-changed',
    ];
    events.forEach((event) => auctionSocket.on(event, handleAuctionEvent));

    return () => {
      auctionSocket.emit('leave-auction', tournamentId);
      events.forEach((event) => auctionSocket.off(event, handleAuctionEvent));
      auctionSocket.disconnect();
    };
  }, [tournamentId, handleAuctionEvent]);

  if (isLoading) return <Spinner />;

  const auction = data?.data ?? data;
  const currentPlayer = auction?.currentPlayerId;
  const soldPlayers = auction?.soldPlayers || [];
  const goingOnce = auction?.goingOnce ?? false;
  const goingTwice = auction?.goingTwice ?? false;
  const bidIncrement = auction?.bidIncrement ?? 5;
  const currentSet = auction?.currentSet ?? '';
  const maxSquadSize = auction?.maxSquadSize ?? 15;
  const teams = Array.isArray(teamsData) ? teamsData : teamsData?.teams ?? [];

  const goingStatusLabel = goingTwice ? 'GOING TWICE' : goingOnce ? 'GOING ONCE' : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Auction</h1>
        {auction?.status === 'live' && (
          <span className="bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
            Live
          </span>
        )}
        {currentSet && (
          <span className="bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {currentSet} Set
          </span>
        )}
      </div>

      {!auction ? (
        <EmptyState icon={Gavel} title="No auction found" message="No auction found for this tournament." />
      ) : (
        <>
          {/* Current player on auction */}
          <div
            className={`rounded-xl border p-6 transition-all ${
              goingTwice
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-500/40'
                : goingOnce
                ? 'bg-amber-50 dark:bg-amber-900/15 border-amber-300 dark:border-amber-500/30'
                : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800'
            }`}
          >
            <h2 className="text-sm font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-4">Current Player</h2>
            {currentPlayer ? (
              <>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {currentPlayer.photo ? (
                      <img src={`${import.meta.env.VITE_API_URL || ''}${currentPlayer.photo}`} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500 shrink-0">
                        {currentPlayer.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      {currentPlayer.name || 'Unknown Player'}
                    </p>
                    {currentPlayer.skill && (
                      <p className="text-emerald-600 dark:text-emerald-400 text-sm capitalize mt-1 font-medium">
                        {currentPlayer.skill}
                      </p>
                    )}
                    {currentPlayer.basePoints != null && (
                      <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
                        Base: <span className="text-slate-700 dark:text-gray-200 font-medium">{currentPlayer.basePoints?.toLocaleString()} pts</span>
                      </p>
                    )}
                    <p className="text-slate-400 dark:text-gray-500 text-xs mt-1">
                      Any amount above current bid accepted
                    </p>
                  </div>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-slate-400 dark:text-gray-500 text-xs uppercase tracking-wider font-medium">Current Bid</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {(auction.currentBid ?? 0).toLocaleString()} <span className="text-base font-medium">pts</span>
                    </p>
                    {auction.currentBidderId && (
                      <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
                        {auction.currentBidderId?.name || 'Unknown team'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Going once / twice status */}
                {goingStatusLabel && (
                  <div className={`mt-4 text-center py-2.5 rounded-lg font-bold text-sm uppercase tracking-widest border-2 animate-pulse ${
                    goingTwice
                      ? 'border-orange-400 dark:border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-amber-400 dark:border-amber-500 text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/15'
                  }`}>
                    {goingStatusLabel}
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-500 dark:text-gray-400 text-sm">
                {auction.status === 'completed' ? 'Auction has ended.' : 'Waiting for next player...'}
              </p>
            )}
          </div>

          {/* Team Points Table */}
          {teams.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Team Points</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teams.map((team) => {
                  const totalPts = team.totalPoints ?? team.budget ?? 1000;
                  const remainingPts = team.remainingPoints ?? team.remainingBudget ?? totalPts;
                  const squadCount = team.playerCount ?? 0;
                  const pctUsed = totalPts > 0 ? Math.round(((totalPts - remainingPts) / totalPts) * 100) : 0;
                  return (
                    <div key={team._id} className="p-3 bg-slate-50 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{team.name}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg mt-0.5">
                        {remainingPts?.toLocaleString()} pts
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          Squad: <span className="text-slate-700 dark:text-gray-300 font-medium">{squadCount}/{maxSquadSize}</span>
                        </p>
                        <p className="text-xs text-slate-400 dark:text-gray-500">{pctUsed}% used</p>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
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

          {/* Sold players */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Sold Players <span className="text-slate-400 dark:text-gray-500 font-normal text-sm">({soldPlayers.length})</span>
            </h2>
            {soldPlayers.length === 0 ? (
              <p className="text-slate-500 dark:text-gray-400 text-sm">No players sold yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {soldPlayers.map((sp, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4"
                  >
                    <p className="text-slate-900 dark:text-white font-semibold text-sm">
                      {sp.playerId?.name || 'Unknown'}
                    </p>
                    {sp.teamId && (
                      <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
                        → {sp.teamId?.name || sp.teamId}
                      </p>
                    )}
                    {sp.amount != null && (
                      <p className="text-emerald-600 dark:text-emerald-400 font-bold mt-2">
                        {sp.amount?.toLocaleString()} pts
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
