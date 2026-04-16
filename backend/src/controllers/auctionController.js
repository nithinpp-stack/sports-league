import Auction from '../models/Auction.js';
import Bid from '../models/Bid.js';
import Player from '../models/Player.js';
import Team from '../models/Team.js';

// Helper: determine minimum bid increment based on current bid (points-based)
function getBidIncrement(currentBid) {
  if (currentBid < 50) return 5;
  if (currentBid < 100) return 10;
  if (currentBid < 200) return 20;
  return 50;
}

// GET /:tournamentId
export const getAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findOne({ tournamentId: req.params.tournamentId })
      .populate('currentPlayerId', 'name skill basePoints')
      .populate('currentBidderId', 'name');
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }
    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/start
export const startAuction = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const { playerSets: customSets, maxSquadSize = 15 } = req.body;

    const existing = await Auction.findOne({ tournamentId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Auction already exists for this tournament' });
    }

    const players = await Player.find({ tournamentId, status: 'available' }).select('_id basePoints');
    const playerIds = players.map((p) => p._id);

    // Build player sets
    let playerSets = [];
    if (customSets && Array.isArray(customSets) && customSets.length > 0) {
      playerSets = customSets;
    } else {
      // Auto-create sets based on basePoints tiers
      const marquee = players.filter((p) => (p.basePoints ?? 0) >= 100).map((p) => p._id);
      const capped = players.filter((p) => (p.basePoints ?? 0) >= 50 && (p.basePoints ?? 0) < 100).map((p) => p._id);
      const uncapped = players.filter((p) => (p.basePoints ?? 0) < 50).map((p) => p._id);
      if (marquee.length) playerSets.push({ name: 'Marquee', playerIds: marquee });
      if (capped.length) playerSets.push({ name: 'Capped', playerIds: capped });
      if (uncapped.length) playerSets.push({ name: 'Uncapped', playerIds: uncapped });
    }

    const currentSet = playerSets.length > 0 ? playerSets[0].name : '';

    const auction = await Auction.create({
      tournamentId,
      status: 'live',
      remainingPlayers: playerIds,
      playerSets,
      currentSet,
      maxSquadSize,
    });

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('auction-started', { tournamentId, auction });

    res.status(201).json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/pause
export const pauseAuction = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }

    auction.status = 'paused';
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('auction-paused', { tournamentId, auction });

    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/resume
export const resumeAuction = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }

    auction.status = 'live';
    await auction.save();

    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/end
export const endAuction = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }

    auction.status = 'completed';
    auction.currentPlayerId = undefined;
    auction.currentBid = 0;
    auction.currentBidderId = undefined;
    auction.timer = 0;
    auction.goingOnce = false;
    auction.goingTwice = false;
    await auction.save();

    const summary = {
      soldCount: auction.soldPlayers.length,
      unsoldCount: auction.unsoldPlayers.length,
      remainingCount: auction.remainingPlayers.length,
    };

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('auction-ended', { tournamentId, summary });

    res.json({ success: true, data: { auction, summary } });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/next-player
export const nextPlayer = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }

    // If playerSets exist, pick next player from current set first
    let nextPlayerId = null;
    if (auction.playerSets && auction.playerSets.length > 0 && auction.currentSet) {
      const setIndex = auction.playerSets.findIndex((s) => s.name === auction.currentSet);
      if (setIndex !== -1) {
        const setPlayerIds = auction.playerSets[setIndex].playerIds;
        // Find first player in this set that is still in remainingPlayers
        const remainingSet = setPlayerIds.filter((pid) =>
          auction.remainingPlayers.some((rp) => rp.toString() === pid.toString())
        );
        if (remainingSet.length > 0) {
          nextPlayerId = remainingSet[0];
          // Remove from remainingPlayers
          auction.remainingPlayers = auction.remainingPlayers.filter(
            (rp) => rp.toString() !== nextPlayerId.toString()
          );
        }
      }
    }

    // Fallback to generic remainingPlayers queue
    if (!nextPlayerId) {
      if (auction.remainingPlayers.length === 0) {
        return res.status(400).json({ success: false, message: 'No more players remaining' });
      }
      nextPlayerId = auction.remainingPlayers.shift();
    }

    const player = await Player.findById(nextPlayerId);
    const basePoints = player?.basePoints ?? 0;
    const increment = getBidIncrement(basePoints);

    auction.currentPlayerId = nextPlayerId;
    auction.currentBid = basePoints;
    auction.currentBidderId = undefined;
    auction.timer = 30;
    auction.bidIncrement = increment;
    auction.goingOnce = false;
    auction.goingTwice = false;
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('new-player', {
      tournamentId,
      player,
      currentBid: auction.currentBid,
      timer: auction.timer,
      bidIncrement: auction.bidIncrement,
    });

    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/bid
export const placeBid = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    let { teamId, amount } = req.body;

    // Auto-detect team for managers
    if (!teamId && req.user.role === 'manager') {
      const myTeam = await Team.findOne({ managerId: req.user.id, tournamentId });
      if (!myTeam) return res.status(403).json({ success: false, message: 'No team assigned to you in this tournament' });
      teamId = myTeam._id;
    }

    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }
    if (auction.status !== 'live') {
      return res.status(400).json({ success: false, message: 'Auction is not live' });
    }
    if (!auction.currentPlayerId) {
      return res.status(400).json({ success: false, message: 'No current player up for auction' });
    }

    const minBid = auction.currentBid + auction.bidIncrement;
    if (amount < minBid) {
      return res.status(400).json({
        success: false,
        message: `Bid must be at least ${minBid} pts (current: ${auction.currentBid} + increment: ${auction.bidIncrement})`,
      });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    if (team.remainingPoints < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient points' });
    }

    // Squad size check
    const maxSquad = auction.maxSquadSize ?? 15;
    if (team.playerCount >= maxSquad) {
      return res.status(400).json({
        success: false,
        message: `Team has reached max squad size of ${maxSquad}`,
      });
    }

    auction.currentBid = amount;
    auction.currentBidderId = teamId;
    auction.timer = 15;
    auction.goingOnce = false;
    auction.goingTwice = false;
    await auction.save();

    await Bid.create({
      auctionId: auction._id,
      playerId: auction.currentPlayerId,
      teamId,
      amount,
    });

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('new-bid', {
      tournamentId,
      teamId,
      amount,
      timer: 15,
      bidIncrement: getBidIncrement(amount),
    });

    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/going-once
export const goingOnceAction = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }
    if (!auction.currentPlayerId) {
      return res.status(400).json({ success: false, message: 'No current player up for auction' });
    }

    auction.goingOnce = true;
    auction.goingTwice = false;
    auction.timer = 10;
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('going-once', {
      tournamentId,
      currentBid: auction.currentBid,
      timer: 10,
    });

    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/going-twice
export const goingTwiceAction = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }
    if (!auction.currentPlayerId) {
      return res.status(400).json({ success: false, message: 'No current player up for auction' });
    }

    auction.goingOnce = true;
    auction.goingTwice = true;
    auction.timer = 5;
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('going-twice', {
      tournamentId,
      currentBid: auction.currentBid,
      timer: 5,
    });

    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/sell
export const sellPlayer = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }
    if (!auction.currentPlayerId || !auction.currentBidderId) {
      return res.status(400).json({ success: false, message: 'No current player or bidder' });
    }

    const playerId = auction.currentPlayerId;
    const teamId = auction.currentBidderId;
    const amount = auction.currentBid;

    // Squad size check before selling
    const team = await Team.findById(teamId);
    const maxSquad = auction.maxSquadSize ?? 15;
    if (team && team.playerCount >= maxSquad) {
      return res.status(400).json({
        success: false,
        message: `Team has reached max squad size of ${maxSquad}`,
      });
    }

    await Player.findByIdAndUpdate(playerId, { teamId, status: 'sold' });
    await Team.findByIdAndUpdate(teamId, {
      $inc: { remainingPoints: -amount, playerCount: 1 },
    });

    auction.soldPlayers.push({ playerId, teamId, amount });
    auction.currentPlayerId = undefined;
    auction.currentBid = 0;
    auction.currentBidderId = undefined;
    auction.timer = 0;
    auction.goingOnce = false;
    auction.goingTwice = false;
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('player-sold', { tournamentId, playerId, teamId, amount });

    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/unsold
export const markUnsold = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }
    if (!auction.currentPlayerId) {
      return res.status(400).json({ success: false, message: 'No current player' });
    }

    const playerId = auction.currentPlayerId;
    await Player.findByIdAndUpdate(playerId, { status: 'unsold' });

    auction.unsoldPlayers.push(playerId);
    auction.currentPlayerId = undefined;
    auction.currentBid = 0;
    auction.currentBidderId = undefined;
    auction.timer = 0;
    auction.goingOnce = false;
    auction.goingTwice = false;
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('player-unsold', { tournamentId, playerId });

    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};

// POST /:tournamentId/change-set
export const changeSet = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const { setName } = req.body;
    if (!setName) {
      return res.status(400).json({ success: false, message: 'setName is required' });
    }

    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }

    auction.currentSet = setName;
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('set-changed', { tournamentId, currentSet: setName });

    res.json({ success: true, data: auction });
  } catch (err) {
    next(err);
  }
};
