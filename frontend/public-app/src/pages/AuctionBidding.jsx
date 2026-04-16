import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { auctionSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';
import { ChevronLeft, Clock, AlertCircle } from '../components/ui/Icons';

export default function AuctionBidding() {
  const { tournamentId } = useParams();
  const { user } = useAuth();

  const [auction, setAuction] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [goingOnce, setGoingOnce] = useState(false);
  const [goingTwice, setGoingTwice] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);
  const [soldOverlay, setSoldOverlay] = useState(null);
  const [unsoldOverlay, setUnsoldOverlay] = useState(false);

  const bidHistoryRef = useRef(null);

  const fetchAuction = useCallback(async () => {
    try {
      const res = await api.get(`/auctions/${tournamentId}`);
      const data = res.data?.data ?? res.data;
      setAuction(data);
      setGoingOnce(data?.goingOnce ?? false);
      setGoingTwice(data?.goingTwice ?? false);
    } catch {}
  }, [tournamentId]);

  const fetchMyTeam = useCallback(async () => {
    try {
      const res = await api.get(`/teams/my-team?tournamentId=${tournamentId}`);
      setMyTeam(res.data?.data ?? res.data);
    } catch {}
  }, [tournamentId]);

  const fetchAllTeams = useCallback(async () => {
    try {
      const res = await api.get(`/tournaments/${tournamentId}/teams`);
      const data = res.data?.data ?? res.data;
      setAllTeams(Array.isArray(data) ? data : data?.teams ?? []);
    } catch {}
  }, [tournamentId]);

  const refreshAll = useCallback(() => {
    fetchAuction();
    fetchMyTeam();
    fetchAllTeams();
  }, [fetchAuction, fetchMyTeam, fetchAllTeams]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchAuction(), fetchMyTeam(), fetchAllTeams()]);
      setLoading(false);
    };
    init();
  }, [fetchAuction, fetchMyTeam, fetchAllTeams]);

  useEffect(() => {
    auctionSocket.connect();
    auctionSocket.emit('join-auction', tournamentId);

    auctionSocket.on('new-player', () => { setGoingOnce(false); setGoingTwice(false); setBidHistory([]); refreshAll(); });
    auctionSocket.on('new-bid', (data) => { setGoingOnce(false); setGoingTwice(false); setBidHistory((p) => [{ team: data.teamName || data.team || 'Unknown', amount: data.amount, time: new Date() }, ...p]); refreshAll(); });
    auctionSocket.on('bid-placed', (data) => { setGoingOnce(false); setGoingTwice(false); setBidHistory((p) => [{ team: data.teamName || data.team || 'Unknown', amount: data.amount, time: new Date() }, ...p]); refreshAll(); });
    auctionSocket.on('going-once', () => { setGoingOnce(true); setGoingTwice(false); });
    auctionSocket.on('going-twice', () => { setGoingOnce(true); setGoingTwice(true); });
    auctionSocket.on('player-sold', (data) => { setSoldOverlay(data); setGoingOnce(false); setGoingTwice(false); setTimeout(() => setSoldOverlay(null), 2500); refreshAll(); });
    auctionSocket.on('player-unsold', () => { setUnsoldOverlay(true); setGoingOnce(false); setGoingTwice(false); setTimeout(() => setUnsoldOverlay(false), 2000); refreshAll(); });
    auctionSocket.on('auction-ended', () => refreshAll());
    auctionSocket.on('auction-started', () => refreshAll());
    auctionSocket.on('set-changed', () => refreshAll());
    auctionSocket.on('player-listed', () => refreshAll());
    auctionSocket.on('football-event', () => {});

    return () => {
      auctionSocket.emit('leave-auction', tournamentId);
      auctionSocket.removeAllListeners();
      auctionSocket.disconnect();
    };
  }, [tournamentId, refreshAll]);

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
    if (!amt || amt < nextMinBid) { toast.error(`Minimum bid is ${nextMinBid} pts`); return; }
    handleBid(amt);
  };

  if (loading) return <Spinner size="lg" />;

  return (
    <div className="min-h-[calc(100vh-7rem)] relative">
      {/* SOLD Overlay */}
      {soldOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="text-center animate-scale-in bg-white dark:bg-gray-900 rounded-2xl px-12 py-10 border border-emerald-200 dark:border-emerald-700 shadow-xl max-w-md mx-4">
            <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">SOLD</p>
            <p className="text-lg text-slate-900 dark:text-white mt-3 font-semibold">
              {soldOverlay.playerName || soldOverlay.player || 'Player'}
            </p>
            <p className="text-base text-emerald-600 dark:text-emerald-400 mt-1">
              {soldOverlay.amount?.toLocaleString()} pts → {soldOverlay.teamName || soldOverlay.team || ''}
            </p>
          </div>
        </div>
      )}

      {/* UNSOLD Overlay */}
      {unsoldOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="text-center animate-scale-in bg-white dark:bg-gray-900 rounded-2xl px-12 py-10 border border-red-200 dark:border-red-700 shadow-xl max-w-md mx-4">
            <p className="text-4xl font-bold text-red-500 dark:text-red-400 tracking-wide">UNSOLD</p>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link
            to={`/auctions/${tournamentId}`}
            className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <ChevronLeft size={16} />
            Back to Viewer
          </Link>
          {isLive && (
            <span className="bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
              Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {myTeam && (
            <>
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-900 dark:text-white font-medium text-sm">{myTeam.name}</span>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium">Points</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-tight">{remainingPoints.toLocaleString()}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium">Squad</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {squadCount}<span className="text-slate-400 dark:text-gray-500 text-sm font-medium">/{maxSquadSize}</span>
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: Bid History */}
        <div className="lg:col-span-1 order-3 lg:order-1">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 lg:max-h-[calc(100vh-200px)] flex flex-col">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3">Bid History</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1" ref={bidHistoryRef}>
              {bidHistory.length === 0 ? (
                <p className="text-slate-400 dark:text-gray-500 text-sm text-center py-8">No bids yet</p>
              ) : (
                bidHistory.map((bid, i) => (
                  <div
                    key={i}
                    className={`py-2 px-3 rounded-lg border transition-all ${
                      i === 0
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/50'
                        : 'bg-slate-50 dark:bg-gray-800 border-slate-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-900 dark:text-white text-sm font-medium truncate">{bid.team}</span>
                      <span className={`font-bold text-sm ${i === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-gray-300'}`}>
                        {bid.amount?.toLocaleString()} pts
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">
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
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-slate-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {isEnded ? 'Auction Complete' : 'Waiting for Auction...'}
              </h2>
              <p className="text-slate-500 dark:text-gray-400 text-sm">
                {isEnded ? 'All players have been auctioned.' : 'The auction has not started yet.'}
              </p>
            </div>
          ) : !currentPlayer ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 flex items-center justify-center mx-auto mb-5 animate-pulse">
                <Clock size={28} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Waiting for Next Player</h2>
              <p className="text-slate-500 dark:text-gray-400 text-sm">The auctioneer is selecting the next player...</p>
            </div>
          ) : (
            <div className="w-full max-w-lg mx-auto text-center space-y-5">
              {/* Player Card */}
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-center gap-3 mb-1">
                  {currentPlayer.skill && (
                    <span className="bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider border border-blue-200 dark:border-blue-500/30">
                      {currentPlayer.skill}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {currentPlayer.name || 'Unknown Player'}
                </h2>
                {currentPlayer.basePoints != null && (
                  <p className="text-slate-500 dark:text-gray-400 text-sm mt-1.5">
                    Base: <span className="text-slate-700 dark:text-gray-300 font-medium">{currentPlayer.basePoints?.toLocaleString()} pts</span>
                  </p>
                )}
              </div>

              {/* Current Bid Display */}
              <div className="py-3">
                <p className="text-slate-400 dark:text-gray-500 text-xs uppercase tracking-wider font-medium mb-2">Current Bid</p>
                <p className="text-5xl font-bold text-emerald-600 dark:text-emerald-400 leading-none tracking-tight">
                  {currentBid.toLocaleString()}
                  <span className="text-xl text-emerald-500/70 dark:text-emerald-400/70 ml-2 font-medium">pts</span>
                </p>
                <p className="text-slate-500 dark:text-gray-400 text-sm mt-2">
                  {auction.currentBidderId
                    ? <>by <span className="text-slate-900 dark:text-white font-medium">{auction.currentBidderId?.name || 'Unknown team'}</span></>
                    : 'Opening bid'
                  }
                </p>
                <p className="text-slate-400 dark:text-gray-500 text-xs mt-2">
                  Min increment: +{bidIncrement} · Next min: <span className="text-blue-600 dark:text-blue-400 font-medium">{nextMinBid.toLocaleString()} pts</span>
                </p>
              </div>

              {/* Going Once / Twice Banners */}
              {goingTwice ? (
                <div className="border-2 border-orange-400 dark:border-orange-500 rounded-lg py-2.5 px-6 animate-pulse bg-orange-50 dark:bg-orange-900/20">
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Going Twice</p>
                </div>
              ) : goingOnce ? (
                <div className="border-2 border-amber-400 dark:border-amber-500 rounded-lg py-2.5 px-6 animate-pulse bg-amber-50 dark:bg-amber-900/15">
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">Going Once</p>
                </div>
              ) : null}

              {/* Bid Controls */}
              <div className="space-y-3 pt-1">
                <button
                  onClick={handleQuickBid}
                  disabled={isBidDisabled || bidding}
                  className={`w-full py-3 rounded-lg text-base font-medium transition-all ${
                    isBidDisabled || bidding
                      ? 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600 cursor-not-allowed border border-slate-200 dark:border-gray-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 hover:border-emerald-700'
                  }`}
                >
                  {bidding ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Placing Bid...
                    </span>
                  ) : (
                    `Bid ${nextMinBid.toLocaleString()} pts`
                  )}
                </button>

                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={`Custom amount (min ${nextMinBid})`}
                    disabled={isBidDisabled}
                    className="flex-1 bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    onKeyDown={(e) => e.key === 'Enter' && handleCustomBid()}
                  />
                  <button
                    onClick={handleCustomBid}
                    disabled={isBidDisabled || bidding || !customAmount}
                    className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${
                      isBidDisabled || bidding || !customAmount
                        ? 'bg-slate-100 dark:bg-gray-800 text-slate-400 dark:text-gray-600 cursor-not-allowed border border-slate-200 dark:border-gray-700'
                        : 'bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700'
                    }`}
                  >
                    Place Bid
                  </button>
                </div>

                {disabledReason && currentPlayer && (
                  <p className="text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center justify-center gap-1.5">
                    <AlertCircle size={14} />
                    {disabledReason}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: All Teams */}
        <div className="lg:col-span-1 order-2 lg:order-3">
          <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 lg:max-h-[calc(100vh-200px)] flex flex-col">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3">All Teams</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {allTeams.length === 0 ? (
                <p className="text-slate-400 dark:text-gray-500 text-sm text-center py-8">No teams found</p>
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
                      className={`p-3 rounded-lg border transition-all ${
                        isMyTeam
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40'
                          : 'bg-slate-50 dark:bg-gray-800 border-slate-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium truncate ${isMyTeam ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                          {team.name}
                          {isMyTeam && <span className="text-emerald-500 dark:text-emerald-500 text-xs ml-1">(You)</span>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{remPts.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 dark:text-gray-500">{sc}/{maxSquadSize}</span>
                      </div>
                      <div className="mt-1.5 h-1 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isMyTeam ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-gray-500'}`}
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
  );
}
