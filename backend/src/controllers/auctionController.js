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
    // soldPlayers.playerId / .teamId are populated so the team-side bidding
    // UI can render the auction history and per-team squad roster without
    // needing a second round-trip per sale.
    const auction = await Auction.findOne({ tournamentId: req.params.tournamentId })
      .populate('currentPlayerId', 'name skill basePoints photo')
      .populate('currentBidderId', 'name')
      .populate('soldPlayers.playerId', 'name skill basePoints photo')
      .populate('soldPlayers.teamId', 'name');
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
    const { playerSets: customSets, maxSquadSize = 15, minSquadSize = 11 } = req.body;

    const existing = await Auction.findOne({ tournamentId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Auction already exists for this tournament' });
    }

    const players = await Player.find({ tournamentId, status: 'available' }).select('_id basePoints');
    const playerIds = players.map((p) => p._id);

    // Build player sets. Each set carries an `order` number — nextPlayer()
    // walks sets in ascending order when auto-advancing past an empty one,
    // so the order here fixes the call sequence (Marquee first, then Capped,
    // then Uncapped — same shape as an IPL auction day).
    let playerSets = [];
    if (customSets && Array.isArray(customSets) && customSets.length > 0) {
      // Preserve caller-supplied order if present; otherwise infer from index.
      playerSets = customSets.map((s, idx) => ({
        name: s.name,
        order: typeof s.order === 'number' ? s.order : idx,
        playerIds: s.playerIds || [],
      }));
    } else {
      // Auto-create sets based on basePoints tiers
      const marquee = players.filter((p) => (p.basePoints ?? 0) >= 100).map((p) => p._id);
      const capped = players.filter((p) => (p.basePoints ?? 0) >= 50 && (p.basePoints ?? 0) < 100).map((p) => p._id);
      const uncapped = players.filter((p) => (p.basePoints ?? 0) < 50).map((p) => p._id);
      if (marquee.length) playerSets.push({ name: 'Marquee', order: 0, playerIds: marquee });
      if (capped.length) playerSets.push({ name: 'Capped', order: 1, playerIds: capped });
      if (uncapped.length) playerSets.push({ name: 'Uncapped', order: 2, playerIds: uncapped });
    }

    // First set (by order) is where we start calling.
    const sortedSets = [...playerSets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const currentSet = sortedSets.length > 0 ? sortedSets[0].name : '';

    const auction = await Auction.create({
      tournamentId,
      status: 'live',
      remainingPlayers: playerIds,
      playerSets,
      currentSet,
      maxSquadSize,
      minSquadSize,
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

// POST /:tournamentId/reset — wipe the auction doc so a fresh one can be
// started. Closes the hole where admins had no way to re-pool after new
// players were added post-startAuction, or where an auction was started
// before any players were available (leaving an empty 'completed' doc that
// permanently blocked the Start Auction button).
//
// We also flip every 'unsold' player in the tournament back to 'available'
// so they re-enter the next pool. 'sold' players are left alone — they're
// already on teams and aren't fair game to re-auction.
export const resetAuction = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;
    const auction = await Auction.findOne({ tournamentId });
    if (!auction) {
      return res.status(404).json({ success: false, message: 'Auction not found' });
    }

    const reopened = await Player.updateMany(
      { tournamentId, status: 'unsold' },
      { $set: { status: 'available' } }
    );

    await Auction.deleteOne({ _id: auction._id });

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('auction-reset', { tournamentId });

    res.json({
      success: true,
      message: 'Auction reset. Click Start Auction to repool.',
      data: { reopenedPlayers: reopened.modifiedCount ?? 0 },
    });
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

    // Undersized-team check. We don't block the admin from closing the auction
    // (they may intentionally be running a short-form draft), but we do hand
    // back a warning list so the UI can surface a banner with names + counts.
    const minSquad = auction.minSquadSize ?? 11;
    const tournamentTeams = await Team.find({ tournamentId }).select('_id name playerCount');
    const undersizedTeams = tournamentTeams
      .filter((t) => (t.playerCount ?? 0) < minSquad)
      .map((t) => ({
        teamId: t._id,
        name: t.name,
        playerCount: t.playerCount ?? 0,
        shortfall: minSquad - (t.playerCount ?? 0),
      }));

    const summary = {
      soldCount: auction.soldPlayers.length,
      unsoldCount: auction.unsoldPlayers.length,
      remainingCount: auction.remainingPlayers.length,
      minSquadSize: minSquad,
    };
    const warnings = {
      undersizedTeams,
    };

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('auction-ended', { tournamentId, summary, warnings });

    res.json({ success: true, data: { auction, summary, warnings } });
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

    // Helper: find the first still-unsold player in a given set.
    const nextInSet = (setName) => {
      if (!setName) return null;
      const set = auction.playerSets.find((s) => s.name === setName);
      if (!set) return null;
      const hit = set.playerIds.find((pid) =>
        auction.remainingPlayers.some((rp) => rp.toString() === pid.toString())
      );
      return hit || null;
    };

    let nextPlayerId = null;
    let setChanged = false;

    // 1) Try the current set
    if (auction.playerSets?.length && auction.currentSet) {
      nextPlayerId = nextInSet(auction.currentSet);
    }

    // 2) If the current set is exhausted, walk forward by `order` to find the
    //    next set that still has remaining players. First-hit wins. This is
    //    the core auto-advance behaviour — admins no longer have to manually
    //    click Change Set when a bracket is empty.
    if (!nextPlayerId && auction.playerSets?.length) {
      const currentOrder = auction.playerSets.find((s) => s.name === auction.currentSet)?.order ?? -1;
      const upcoming = auction.playerSets
        .filter((s) => (s.order ?? 0) > currentOrder)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      for (const set of upcoming) {
        const hit = nextInSet(set.name);
        if (hit) {
          nextPlayerId = hit;
          auction.currentSet = set.name;
          setChanged = true;
          break;
        }
      }
    }

    // 3) Remove the picked player from remainingPlayers
    if (nextPlayerId) {
      auction.remainingPlayers = auction.remainingPlayers.filter(
        (rp) => rp.toString() !== nextPlayerId.toString()
      );
    }

    // 4) Fallback — no sets configured, or every set has been walked through.
    //    Pull from whatever's left in the generic queue so the auction doesn't
    //    deadlock on orphaned players that weren't assigned to a set.
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
    // If nextPlayer() auto-advanced past an empty set, tell the room BEFORE
    // the new-player emit so clients can update the set badge / progress
    // counter in the correct order.
    if (setChanged) {
      io.of('/auction').to(`auction:${tournamentId}`).emit('set-changed', {
        tournamentId,
        currentSet: auction.currentSet,
        auto: true,
      });
    }
    io.of('/auction').to(`auction:${tournamentId}`).emit('new-player', {
      tournamentId,
      player,
      currentBid: auction.currentBid,
      timer: auction.timer,
      bidIncrement: auction.bidIncrement,
      currentSet: auction.currentSet,
      setChanged,
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

    // Bid rule simplified: any amount strictly greater than the current bid
    // is accepted. If no one has bid yet (opening bid for this player), the
    // first bidder can match the base price exactly. The only real ceiling
    // is the team's remainingPoints (checked below). The old bracket-aware
    // minimum-increment and step-ladder rules were removed because the real
    // auction ceiling is the team's budget, not an arbitrary step size.
    const hasBidder = Boolean(auction.currentBidderId);
    const meetsMin = hasBidder ? amount > auction.currentBid : amount >= auction.currentBid;
    if (!meetsMin) {
      const minBid = hasBidder ? auction.currentBid + 1 : auction.currentBid;
      return res.status(400).json({
        success: false,
        message: hasBidder
          ? `Minimum bid: ${minBid} pts`
          : `Minimum bid: ${minBid} pts (base price)`,
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
    // Persist the bracket-aware increment that now applies at the NEW bid
    // level so that a page reload between bids shows the correct step, not a
    // stale value from the previous nextPlayer() call.
    auction.bidIncrement = getBidIncrement(amount);
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
