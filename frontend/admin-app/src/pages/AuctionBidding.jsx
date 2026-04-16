import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { auctionSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export default function AuctionBidding() {
  const { tournamentId } = useParams();
  const { user } = useAuth();

  // Auction state
  const [auction, setAuction] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bid UI state
  const [customAmount, setCustomAmount] = useState('');
  const [bidding, setBidding] = useState(false);

  // Real-time flags
  const [goingOnce, setGoingOnce] = useState(false);
  const [goingTwice, setGoingTwice] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);

  // SOLD overlay
  const [soldOverlay, setSoldOverlay] = useState(null);
  const [unsoldOverlay, setUnsoldOverlay] = useState(false);

  const bidHistoryRef = useRef(null);

  // --- Data fetching ---
  const fetchAuction = useCallback(async () => {
    try {
      const res = await api.get(`/auctions/${tournamentId}`);
      const data = res.data?.data ?? res.data;
      setAuction(data);
      setGoingOnce(data?.goingOnce ?? false);
      setGoingTwice(data?.goingTwice ?? false);
    } catch {
      // silently fail
    }
  }, [tournamentId]);

  const fetchMyTeam = useCallback(async () => {
    try {
      const res = await api.get(`/teams/my-team?tournamentId=${tournamentId}`);
      setMyTeam(res.data?.data ?? res.data);
    } catch {
      // may not have a team
    }
  }, [tournamentId]);

  const fetchAllTeams = useCallback(async () => {
    try {
      const res = await api.get(`/tournaments/${tournamentId}/teams`);
      const data = res.data?.data ?? res.data;
      setAllTeams(Array.isArray(data) ? data : data?.teams ?? []);
    } catch {
      // silently fail
    }
  }, [tournamentId]);

  const refreshAll = useCallback(() => {
    fetchAuction();
    fetchMyTeam();
    fetchAllTeams();
  }, [fetchAuction, fetchMyTeam, fetchAllTeams]);

  // --- Initial load ---
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchAuction(), fetchMyTeam(), fetchAllTeams()]);
      setLoading(false);
    };
    init();
  }, [fetchAuction, fetchMyTeam, fetchAllTeams]);

  // --- Socket.IO ---
  useEffect(() => {
    auctionSocket.connect();
    auctionSocket.emit('join-auction', tournamentId);

    auctionSocket.on('new-player', (data) => {
      setGoingOnce(false);
      setGoingTwice(false);
      setBidHistory([]);
      refreshAll();
    });

    auctionSocket.on('new-bid', (data) => {
      setGoingOnce(false);
      setGoingTwice(false);
      setBidHistory((prev) => [
        { team: data.teamName || data.team || 'Unknown', amount: data.amount, time: new Date() },
        ...prev,
      ]);
      refreshAll();
    });

    auctionSocket.on('bid-placed', (data) => {
      setGoingOnce(false);
      setGoingTwice(false);
      setBidHistory((prev) => [
        { team: data.teamName || data.team || 'Unknown', amount: data.amount, time: new Date() },
        ...prev,
      ]);
      refreshAll();
    });

    auctionSocket.on('going-once', () => {
      setGoingOnce(true);
      setGoingTwice(false);
    });

    auctionSocket.on('going-twice', () => {
      setGoingOnce(true);
      setGoingTwice(true);
    });

    auctionSocket.on('player-sold', (data) => {
      setSoldOverlay(data);
      setGoingOnce(false);
      setGoingTwice(false);
      setTimeout(() => setSoldOverlay(null), 2500);
      refreshAll();
    });

    auctionSocket.on('player-unsold', () => {
      setUnsoldOverlay(true);
      setGoingOnce(false);
      setGoingTwice(false);
      setTimeout(() => setUnsoldOverlay(false), 2000);
      refreshAll();
    });

    auctionSocket.on('auction-ended', () => {
      refreshAll();
    });

    auctionSocket.on('auction-started', () => {
      refreshAll();
    });

    auctionSocket.on('set-changed', () => {
      refreshAll();
    });

    auctionSocket.on('player-listed', () => {
      refreshAll();
    });

    // Ignore football events
    auctionSocket.on('football-event', () => {});

    return () => {
      auctionSocket.emit('leave-auction', tournamentId);
      auctionSocket.removeAllListeners();
      auctionSocket.disconnect();
    };
  }, [tournamentId, refreshAll]);

  // --- Bid logic ---
  const currentPlayer = auction?.currentPlayerId;
  const currentBid = auction?.currentBid ?? 0;
  const bidIncrement = auction?.bidIncrement ?? 5;
  const nextMinBid = currentBid + bidIncrement;
  const maxSquadSize = auction?.maxSquadSize ?? 15;
  const remainingPoints = myTeam?.remainingPoints ?? myTeam?.remainingBudget ?? 0;
  const squadCount = myTeam?.playerCount ?? myTeam?.players?.length ?? 0;
  const isSquadFull = squadCount >= maxSquadSize;
  const canAfford = remainingPoints >= nextMinBid;
  const isPaused = auction?.status === 'paused';
  const isLive = auction?.status === 'live';
  const isEnded = auction?.status === 'completed';
  const isCurrentBidder = auction?.currentBidderId?._id === myTeam?._id || auction?.currentBidderId === myTeam?._id;

  const getDisabledReason = () => {
    if (!isLive) return 'Auction is not live';
    if (isPaused) return 'Auction is paused';
    if (!currentPlayer) return 'No player on the block';
    if (isSquadFull) return 'Squad full (max ' + maxSquadSize + ')';
    if (isCurrentBidder) return 'You are the current highest bidder';
    if (!canAfford) return 'Insufficient points';
    return null;
  };

  const disabledReason = getDisabledReason();
  const isBidDisabled = !!disabledReason;

  const handleBid = async (amount) => {
    if (bidding || isBidDisabled) return;
    setBidding(true);
    try {
      await api.post(`/auctions/${tournamentId}/bid`, { amount });
      toast.success(`Bid placed: ${amount} pts`);
      setCustomAmount('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bid failed');
    } finally {
      setBidding(false);
    }
  };

  const handleQuickBid = () => handleBid(nextMinBid);

  const handleCustomBid = () => {
    const amt = parseInt(customAmount, 10);
    if (!amt || amt < nextMinBid) {
      toast.error(`Minimum bid is ${nextMinBid} pts`);
      return;
    }
    handleBid(amt);
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Connecting to auction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-gray-950 to-indigo-950/10 pointer-events-none" />

      {/* SOLD Overlay */}
      {soldOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="text-center animate-scale-in">
            <div className="absolute inset-0 bg-emerald-500/10 animate-pulse" />
            <p className="text-8xl font-black text-emerald-400 tracking-wider drop-shadow-[0_0_40px_rgba(16,185,129,0.6)]">
              SOLD!
            </p>
            <p className="text-2xl text-white mt-4 font-semibold">
              {soldOverlay.playerName || soldOverlay.player || 'Player'}
            </p>
            <p className="text-xl text-emerald-300 mt-2">
              {soldOverlay.amount?.toLocaleString()} pts &rarr; {soldOverlay.teamName || soldOverlay.team || ''}
            </p>
          </div>
        </div>
      )}

      {/* UNSOLD Overlay */}
      {unsoldOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-7xl font-black text-red-400 tracking-wider drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]">
              UNSOLD
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-4 min-h-screen flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Link
              to={`/auctions/${tournamentId}`}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Auction Control
            </Link>
            {isLive && (
              <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse tracking-wide">
                LIVE
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {myTeam && (
              <>
                <div className="bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white font-semibold text-sm">{myTeam.name}</span>
                </div>
                <div className="bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">Points</p>
                  <p className="text-2xl font-black text-emerald-400 leading-tight">{remainingPoints.toLocaleString()}</p>
                </div>
                <div className="bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">Squad</p>
                  <p className="text-2xl font-black text-white leading-tight">
                    {squadCount}<span className="text-gray-500 text-base font-bold">/{maxSquadSize}</span>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Left: Bid History */}
          <div className="lg:col-span-1 order-3 lg:order-1">
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 h-full max-h-[calc(100vh-160px)] flex flex-col">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Bid History</h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1" ref={bidHistoryRef}>
                {bidHistory.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-8">No bids yet</p>
                ) : (
                  bidHistory.map((bid, i) => (
                    <div
                      key={i}
                      className={`py-2.5 px-3 rounded-lg border transition-all ${
                        i === 0
                          ? 'bg-emerald-900/30 border-emerald-700/50'
                          : 'bg-gray-800/50 border-gray-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium truncate">{bid.team}</span>
                        <span className={`font-bold text-sm ${i === 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
                          {bid.amount?.toLocaleString()} pts
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {bid.time?.toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Center: Main Bidding Area */}
          <div className="lg:col-span-2 order-1 lg:order-2 flex flex-col items-center justify-center">
            {!auction || isEnded ? (
              /* Ended / No Auction */
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {isEnded ? 'Auction Complete' : 'Waiting for Auction...'}
                </h2>
                <p className="text-gray-500 text-lg">
                  {isEnded ? 'All players have been auctioned.' : 'The auction has not started yet.'}
                </p>
              </div>
            ) : !currentPlayer ? (
              /* Waiting for next player */
              <div className="text-center py-20">
                <div className="w-20 h-20 rounded-full bg-gray-800/80 border-2 border-gray-700 flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <svg className="w-10 h-10 text-emerald-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Waiting for Next Player</h2>
                <p className="text-gray-500">The auctioneer is selecting the next player...</p>
              </div>
            ) : (
              /* Active bidding */
              <div className="w-full max-w-lg mx-auto text-center space-y-6">
                {/* Player Card */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-center gap-3 mb-1">
                    {currentPlayer.skill && (
                      <span className="bg-indigo-600/30 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-500/30">
                        {currentPlayer.skill}
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl font-bold text-white mt-2">
                    {currentPlayer.name || 'Unknown Player'}
                  </h2>
                  {currentPlayer.basePoints != null && (
                    <p className="text-gray-500 text-sm mt-1.5">
                      Base: <span className="text-gray-300 font-semibold">{currentPlayer.basePoints?.toLocaleString()} pts</span>
                    </p>
                  )}
                </div>

                {/* Current Bid Display */}
                <div className="py-4">
                  <p className="text-gray-500 text-sm uppercase tracking-widest font-medium mb-2">Current Bid</p>
                  <p className="text-7xl font-black text-emerald-400 leading-none tracking-tight drop-shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    {currentBid.toLocaleString()}
                    <span className="text-3xl text-emerald-500/70 ml-2 font-bold">pts</span>
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {auction.currentBidderId
                      ? <>by <span className="text-white font-semibold">{auction.currentBidderId?.name || 'Unknown team'}</span></>
                      : 'Opening bid'
                    }
                  </p>
                  <p className="text-gray-600 text-xs mt-2">
                    Min increment: <span className="text-gray-400">+{bidIncrement}</span> &middot; Next min: <span className="text-indigo-400 font-semibold">{nextMinBid.toLocaleString()} pts</span>
                  </p>
                </div>

                {/* Going Once / Twice Banners */}
                {goingTwice ? (
                  <div className="bg-orange-500 rounded-xl py-3 px-6 animate-pulse shadow-lg shadow-orange-500/20">
                    <p className="text-2xl font-bold text-white tracking-widest">GOING TWICE!</p>
                  </div>
                ) : goingOnce ? (
                  <div className="bg-yellow-500 rounded-xl py-3 px-6 animate-pulse shadow-lg shadow-yellow-500/20">
                    <p className="text-2xl font-bold text-yellow-900 tracking-widest">GOING ONCE!</p>
                  </div>
                ) : null}

                {/* Bid Controls */}
                <div className="space-y-3 pt-2">
                  {/* Quick bid button */}
                  <button
                    onClick={handleQuickBid}
                    disabled={isBidDisabled || bidding}
                    className={`w-full py-4 rounded-xl text-lg font-bold transition-all transform ${
                      isBidDisabled || bidding
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
                        : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 border border-emerald-500'
                    }`}
                  >
                    {bidding ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Placing Bid...
                      </span>
                    ) : (
                      `BID ${nextMinBid.toLocaleString()} pts`
                    )}
                  </button>

                  {/* Custom bid */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder={`Custom amount (min ${nextMinBid})`}
                      disabled={isBidDisabled}
                      className="flex-1 bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      onKeyDown={(e) => e.key === 'Enter' && handleCustomBid()}
                    />
                    <button
                      onClick={handleCustomBid}
                      disabled={isBidDisabled || bidding || !customAmount}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                        isBidDisabled || bidding || !customAmount
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700'
                          : 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                      }`}
                    >
                      Place Bid
                    </button>
                  </div>

                  {/* Disabled reason */}
                  {disabledReason && currentPlayer && (
                    <p className="text-yellow-500/80 text-sm font-medium flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {disabledReason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: All Teams */}
          <div className="lg:col-span-1 order-2 lg:order-3">
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 h-full max-h-[calc(100vh-160px)] flex flex-col">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">All Teams</h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {allTeams.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-8">No teams found</p>
                ) : (
                  allTeams.map((team) => {
                    const totalPts = team.totalPoints ?? team.budget ?? 1000;
                    const remPts = team.remainingPoints ?? team.remainingBudget ?? totalPts;
                    const sc = team.playerCount ?? 0;
                    const pctUsed = totalPts > 0 ? Math.round(((totalPts - remPts) / totalPts) * 100) : 0;
                    const isMyTeam = myTeam && (team._id === myTeam._id);

                    return (
                      <div
                        key={team._id}
                        className={`p-3 rounded-xl border transition-all ${
                          isMyTeam
                            ? 'bg-emerald-900/20 border-emerald-700/40'
                            : 'bg-gray-800/40 border-gray-700/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-semibold truncate ${isMyTeam ? 'text-emerald-300' : 'text-white'}`}>
                            {team.name}
                            {isMyTeam && <span className="text-emerald-500 text-xs ml-1.5">(You)</span>}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-400 font-bold text-base">{remPts.toLocaleString()}</span>
                          <span className="text-xs text-gray-500">{sc}/{maxSquadSize}</span>
                        </div>
                        <div className="mt-1.5 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isMyTeam ? 'bg-emerald-500' : 'bg-gray-500'}`}
                            style={{ width: `${pctUsed}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline keyframe styles */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
