import LiveScore from '../models/LiveScore.js';
import Match from '../models/Match.js';
import Tournament from '../models/Tournament.js';

// GET /:matchId
export const getLiveScore = async (req, res, next) => {
  try {
    const liveScore = await LiveScore.findOne({ matchId: req.params.matchId })
      .populate('innings.batsmen.playerId', 'name skill')
      .populate('innings.batsmen.dismissedBy', 'name')
      .populate('innings.bowlers.playerId', 'name skill')
      .populate('innings.fallOfWickets.playerId', 'name')
      .populate('innings.battingTeamId', 'name')
      .populate('innings.bowlingTeamId', 'name')
      .populate('battingTeamId', 'name')
      .populate('bowlingTeamId', 'name');
    if (!liveScore) {
      return res.status(404).json({ success: false, message: 'Live score not found for this match' });
    }
    res.json({ success: true, data: liveScore });
  } catch (err) {
    next(err);
  }
};

// GET /:matchId/scorecard
export const getScorecard = async (req, res, next) => {
  try {
    const liveScore = await LiveScore.findOne({ matchId: req.params.matchId })
      .populate('innings.batsmen.playerId', 'name skill')
      .populate('innings.batsmen.dismissedBy', 'name')
      .populate('innings.bowlers.playerId', 'name skill')
      .populate('innings.fallOfWickets.playerId', 'name')
      .populate('innings.battingTeamId', 'name')
      .populate('innings.bowlingTeamId', 'name')
      .populate('battingTeamId', 'name')
      .populate('bowlingTeamId', 'name');
    if (!liveScore) {
      return res.status(404).json({ success: false, message: 'Scorecard not found' });
    }
    const match = await Match.findById(req.params.matchId)
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .populate('tournamentId', 'name format sport')
      .populate('manOfMatch', 'name skill')
      .populate('bestBatsman', 'name skill')
      .populate('bestBowler', 'name skill');
    res.json({ success: true, data: { liveScore, match } });
  } catch (err) {
    next(err);
  }
};

// POST /:matchId/start
export const startMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { battingTeamId, bowlingTeamId } = req.body;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    const existing = await LiveScore.findOne({ matchId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Live score already exists for this match' });
    }

    const tournament = await Tournament.findById(match.tournamentId);
    const sport = tournament?.sport || 'cricket';

    let liveScore;

    if (sport === 'football') {
      const { homeTeamId, awayTeamId } = req.body;
      liveScore = await LiveScore.create({
        matchId,
        sport: 'football',
        footballData: {
          homeTeamId,
          awayTeamId,
          homeGoals: 0,
          awayGoals: 0,
          currentHalf: 'not_started',
          currentMinute: 0,
          goals: [],
          cards: [],
          substitutions: [],
        },
      });
    } else {
      liveScore = await LiveScore.create({
        matchId,
        battingTeamId,
        bowlingTeamId,
        currentInnings: 1,
        currentOver: 0,
        currentBall: 0,
        innings: [
          {
            inningsNumber: 1,
            battingTeamId,
            bowlingTeamId,
            totalRuns: 0,
            totalWickets: 0,
            totalOvers: 0,
            extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
            batsmen: [],
            bowlers: [],
            overs: [],
            fallOfWickets: [],
          },
        ],
      });
    }

    match.status = 'live';
    await match.save();

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('match-started', { matchId, liveScore });

    res.status(201).json({ success: true, data: liveScore });
  } catch (err) {
    next(err);
  }
};

// POST /:matchId/ball
export const recordBall = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { batsmanId, bowlerId, runs = 0, extras, isWicket = false, wicket, commentary } = req.body;

    if (!batsmanId) return res.status(400).json({ success: false, message: 'Batsman is required' });
    if (!bowlerId) return res.status(400).json({ success: false, message: 'Bowler is required' });

    const liveScore = await LiveScore.findOne({ matchId });
    if (!liveScore) {
      return res.status(404).json({ success: false, message: 'Live score not found' });
    }

    const inningsIndex = liveScore.currentInnings - 1;
    const innings = liveScore.innings[inningsIndex];
    if (!innings) {
      return res.status(400).json({ success: false, message: 'Current innings not found' });
    }

    const extraRuns = extras?.runs || 0;
    const extraType = extras?.type;
    const isLegalBall = extraType !== 'wide' && extraType !== 'no_ball';

    // Enforce over limit: block legal balls once totalOvers reached
    if (isLegalBall) {
      const match = await Match.findById(matchId);
      const totalOvers = match?.totalOvers ?? 20;
      const completedOvers = liveScore.currentOver;
      const ballsInOver = liveScore.currentBall;
      // If we're at the last ball of the last over (5 balls done, this would be the 6th = completing the over)
      // that's fine — it completes the over. But if overs are already at the limit, block.
      if (completedOvers >= totalOvers) {
        return res.status(400).json({
          success: false,
          message: `Over limit reached (${totalOvers} overs). End the innings or increase total overs.`,
        });
      }
    }

    // Update extras tracking
    if (extraType === 'wide') innings.extras.wides += extraRuns || 1;
    else if (extraType === 'no_ball') innings.extras.noBalls += 1;
    else if (extraType === 'bye') innings.extras.byes += extraRuns;
    else if (extraType === 'leg_bye') innings.extras.legByes += extraRuns;
    if (extraRuns > 0 || extraType === 'wide' || extraType === 'no_ball') {
      innings.extras.total += extraType === 'wide' ? (extraRuns || 1) : extraType === 'no_ball' ? 1 + extraRuns : extraRuns;
    }

    // Determine over index
    let overIndex = innings.overs.findIndex(o => o.overNumber === liveScore.currentOver + 1);
    if (overIndex === -1) {
      innings.overs.push({ overNumber: liveScore.currentOver + 1, bowlerId, balls: [] });
      overIndex = innings.overs.length - 1;
    }

    const ballEntry = {
      ballNumber: liveScore.currentBall + (isLegalBall ? 1 : 0),
      batsmanId,
      bowlerId,
      runs,
      extras: extraRuns + (extraType === 'wide' ? 1 : extraType === 'no_ball' ? 1 : 0),
      extraType: extraType || 'none',
      isWicket,
      wicket: isWicket ? { ...wicket, batsmanId, bowlerId } : undefined,
      commentary,
    };
    innings.overs[overIndex].balls.push(ballEntry);

    // Update innings totals
    const totalExtras = extraType === 'wide' ? (extraRuns || 1) : extraType === 'no_ball' ? 1 + extraRuns : extraRuns;
    innings.totalRuns += runs + totalExtras;

    // Update batsman stats
    let batsman = innings.batsmen.find(b => b.playerId?.toString() === batsmanId?.toString());
    if (!batsman) {
      innings.batsmen.push({ playerId: batsmanId, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, strikeRate: 0 });
      batsman = innings.batsmen[innings.batsmen.length - 1];
    }
    if (isLegalBall) batsman.balls += 1;
    batsman.runs += runs;
    if (runs === 4) batsman.fours += 1;
    if (runs === 6) batsman.sixes += 1;
    batsman.strikeRate = batsman.balls > 0 ? parseFloat(((batsman.runs / batsman.balls) * 100).toFixed(2)) : 0;

    if (isWicket) {
      batsman.isOut = true;
      if (wicket?.type) batsman.dismissalType = wicket.type;
      batsman.dismissedBy = wicket?.fielderId || bowlerId;
      innings.totalWickets += 1;
      innings.fallOfWickets.push({
        wicketNumber: innings.totalWickets,
        playerId: batsmanId,
        runs: innings.totalRuns,
        overs: liveScore.currentOver + (liveScore.currentBall / 6),
      });
    }

    // Update bowler stats
    let bowler = innings.bowlers.find(b => b.playerId?.toString() === bowlerId?.toString());
    if (!bowler) {
      innings.bowlers.push({ playerId: bowlerId, overs: 0, maidens: 0, runs: 0, wickets: 0, noBalls: 0, wides: 0, economyRate: 0 });
      bowler = innings.bowlers[innings.bowlers.length - 1];
    }
    bowler.runs += runs + totalExtras;
    if (isWicket && wicket?.type !== 'run_out') bowler.wickets += 1;
    if (extraType === 'wide') bowler.wides += 1;
    if (extraType === 'no_ball') bowler.noBalls += 1;

    // Advance ball/over counters
    if (isLegalBall) {
      liveScore.currentBall += 1;
      if (liveScore.currentBall >= 6) {
        // Check maiden (no runs in over)
        const currentOverBalls = innings.overs[overIndex].balls;
        const overRuns = currentOverBalls.reduce((sum, b) => sum + b.runs + b.extras, 0);
        if (overRuns === 0) bowler.maidens += 1;

        liveScore.currentOver += 1;
        liveScore.currentBall = 0;
        innings.totalOvers = liveScore.currentOver;
      }
    }

    // Update bowler overs
    bowler.overs = liveScore.currentOver + (liveScore.currentBall > 0 ? liveScore.currentBall / 10 : 0);
    bowler.economyRate = bowler.overs > 0 ? parseFloat((bowler.runs / (bowler.overs)).toFixed(2)) : 0;

    liveScore.lastUpdated = new Date();
    liveScore.markModified('innings');
    await liveScore.save();

    const io = req.app.get('io');
    const room = `match:${matchId}`;
    if (isWicket) {
      io.of('/live-scoring').to(room).emit('wicket', { matchId, liveScore, ball: ballEntry });
    } else {
      io.of('/live-scoring').to(room).emit('ball-update', { matchId, liveScore, ball: ballEntry });
    }

    res.json({ success: true, data: liveScore });
  } catch (err) {
    next(err);
  }
};

// POST /:matchId/end-innings
export const endInnings = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { nextBattingTeamId, nextBowlingTeamId } = req.body;

    const liveScore = await LiveScore.findOne({ matchId });
    if (!liveScore) {
      return res.status(404).json({ success: false, message: 'Live score not found' });
    }

    liveScore.innings.push({
      inningsNumber: liveScore.currentInnings + 1,
      battingTeamId: nextBattingTeamId,
      bowlingTeamId: nextBowlingTeamId,
      totalRuns: 0,
      totalWickets: 0,
      totalOvers: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      batsmen: [],
      bowlers: [],
      overs: [],
      fallOfWickets: [],
    });

    liveScore.currentInnings += 1;
    liveScore.currentOver = 0;
    liveScore.currentBall = 0;
    liveScore.battingTeamId = nextBattingTeamId;
    liveScore.bowlingTeamId = nextBowlingTeamId;
    liveScore.lastUpdated = new Date();
    await liveScore.save();

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('innings-end', { matchId, liveScore });

    res.json({ success: true, data: liveScore });
  } catch (err) {
    next(err);
  }
};

// POST /:matchId/end-match
export const endMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { winner, winType, winMargin, summary, manOfMatch, bestBatsman, bestBowler } = req.body;

    const liveScore = await LiveScore.findOne({ matchId });
    if (!liveScore) {
      return res.status(404).json({ success: false, message: 'Live score not found' });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    // Validation
    if (winner) {
      const validTeams = [match.team1Id.toString(), match.team2Id.toString()];
      if (!validTeams.includes(winner)) {
        return res.status(400).json({ success: false, message: 'Winner must be one of the match teams' });
      }
    }
    if ((winType === 'runs' || winType === 'wickets') && winMargin != null && winMargin <= 0) {
      return res.status(400).json({ success: false, message: 'Win margin must be positive' });
    }

    match.status = 'completed';
    match.result = { winner, winType, winMargin, summary };
    if (manOfMatch) match.manOfMatch = manOfMatch;
    if (bestBatsman) match.bestBatsman = bestBatsman;
    if (bestBowler) match.bestBowler = bestBowler;
    await match.save();

    liveScore.lastUpdated = new Date();
    await liveScore.save();

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('match-end', { matchId, result: match.result, liveScore });

    res.json({ success: true, data: { liveScore, match } });
  } catch (err) {
    next(err);
  }
};

// POST /:matchId/reopen
export const reopenMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (match.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only completed matches can be reopened' });
    }

    match.status = 'live';
    match.result = undefined;
    match.manOfMatch = undefined;
    match.bestBatsman = undefined;
    match.bestBowler = undefined;
    await match.save();

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('match-reopen', { matchId });

    res.json({ success: true, data: { match } });
  } catch (err) {
    next(err);
  }
};

// POST /:matchId/football-event
export const recordFootballEvent = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { eventType, ...eventData } = req.body;

    const liveScore = await LiveScore.findOne({ matchId });
    if (!liveScore || !liveScore.footballData) {
      return res.status(404).json({ success: false, message: 'Football live score not found for this match' });
    }

    const fd = liveScore.footballData;

    switch (eventType) {
      case 'goal': {
        const { playerId, assistedBy, minute, isOwnGoal, isPenalty } = eventData;
        const goal = { playerId, assistedBy, minute, half: fd.currentHalf, isOwnGoal, isPenalty };
        fd.goals.push(goal);
        if (eventData.team === 'home') fd.homeGoals += 1;
        else fd.awayGoals += 1;
        break;
      }
      case 'card': {
        const { playerId, cardType, minute, reason } = eventData;
        fd.cards.push({ playerId, cardType, minute, half: fd.currentHalf, reason });
        break;
      }
      case 'substitution': {
        const { playerOutId, playerInId, minute } = eventData;
        fd.substitutions.push({ playerOutId, playerInId, minute, half: fd.currentHalf });
        break;
      }
      case 'half_change': {
        fd.currentHalf = eventData.half;
        if (eventData.half === '1st') fd.currentMinute = 0;
        if (eventData.half === '2nd') fd.currentMinute = 45;
        break;
      }
      case 'minute_update': {
        fd.currentMinute = eventData.minute;
        break;
      }
      default:
        return res.status(400).json({ success: false, message: `Unknown eventType: ${eventType}` });
    }

    liveScore.lastUpdated = new Date();
    liveScore.markModified('footballData');
    await liveScore.save();

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('football-event', { matchId, eventType, ...eventData, footballData: fd });

    res.json({ success: true, data: liveScore });
  } catch (error) {
    next(error);
  }
};

// POST /:matchId/football-undo
export const undoFootballEvent = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { eventType } = req.body;

    const liveScore = await LiveScore.findOne({ matchId });
    if (!liveScore || !liveScore.footballData) {
      return res.status(404).json({ success: false, message: 'Football live score not found for this match' });
    }

    const fd = liveScore.footballData;
    let popped;

    switch (eventType) {
      case 'goal': {
        if (!fd.goals || fd.goals.length === 0) {
          return res.status(400).json({ success: false, message: 'No goals to undo' });
        }
        popped = fd.goals[fd.goals.length - 1];
        fd.goals.pop();
        // Determine which side to decrement by checking the goal's team via original request
        // The goal entry does not store team directly, so we rely on a 'team' field if stored,
        // otherwise fall back to checking homeGoals/awayGoals conservatively.
        // We store team info in the goal object if provided — check popped for it.
        if (popped.team === 'home' || (!popped.team && fd.homeGoals > 0)) {
          fd.homeGoals = Math.max(0, fd.homeGoals - 1);
        } else {
          fd.awayGoals = Math.max(0, fd.awayGoals - 1);
        }
        break;
      }
      case 'card': {
        if (!fd.cards || fd.cards.length === 0) {
          return res.status(400).json({ success: false, message: 'No cards to undo' });
        }
        popped = fd.cards[fd.cards.length - 1];
        fd.cards.pop();
        break;
      }
      case 'substitution': {
        if (!fd.substitutions || fd.substitutions.length === 0) {
          return res.status(400).json({ success: false, message: 'No substitutions to undo' });
        }
        popped = fd.substitutions[fd.substitutions.length - 1];
        fd.substitutions.pop();
        break;
      }
      default:
        return res.status(400).json({ success: false, message: `Cannot undo eventType: ${eventType}` });
    }

    liveScore.lastUpdated = new Date();
    liveScore.markModified('footballData');
    await liveScore.save();

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('football-event', { matchId, eventType: 'undo', undoneEventType: eventType, undoneEvent: popped, footballData: fd });

    res.json({ success: true, data: liveScore });
  } catch (error) {
    next(error);
  }
};

// POST /:matchId/undo
export const undoLastBall = async (req, res, next) => {
  try {
    const { matchId } = req.params;

    const liveScore = await LiveScore.findOne({ matchId });
    if (!liveScore) {
      return res.status(404).json({ success: false, message: 'Live score not found' });
    }

    const inningsIndex = liveScore.currentInnings - 1;
    const innings = liveScore.innings[inningsIndex];
    if (!innings || innings.overs.length === 0) {
      return res.status(400).json({ success: false, message: 'No balls to undo' });
    }

    const lastOverIndex = innings.overs.length - 1;
    const lastOver = innings.overs[lastOverIndex];
    if (!lastOver || lastOver.balls.length === 0) {
      return res.status(400).json({ success: false, message: 'No balls in last over' });
    }

    const lastBall = lastOver.balls[lastOver.balls.length - 1];

    // Reverse totals
    const totalExtras = lastBall.extras || 0;
    innings.totalRuns -= lastBall.runs + totalExtras;

    // Reverse ball counter (if ball was legal)
    const extraType = lastBall.extraType || 'none';
    const wasLegal = extraType === 'none' || extraType === 'bye' || extraType === 'leg_bye';
    if (wasLegal) {
      if (liveScore.currentBall > 0) {
        liveScore.currentBall -= 1;
      } else if (liveScore.currentOver > 0) {
        // Ball completed an over — reverse over increment
        liveScore.currentOver -= 1;
        liveScore.currentBall = 5;
        innings.totalOvers = liveScore.currentOver;
      }
    }

    // Reverse extras breakdown
    if (extraType === 'wide') {
      const extraVal = lastBall.extras || 1;
      innings.extras.wides = Math.max(0, innings.extras.wides - extraVal);
      innings.extras.total = Math.max(0, innings.extras.total - extraVal);
    } else if (extraType === 'no_ball') {
      innings.extras.noBalls = Math.max(0, innings.extras.noBalls - 1);
      innings.extras.total = Math.max(0, innings.extras.total - totalExtras);
    } else if (extraType === 'bye') {
      const extraVal = lastBall.extras || 0;
      innings.extras.byes = Math.max(0, innings.extras.byes - extraVal);
      innings.extras.total = Math.max(0, innings.extras.total - extraVal);
    } else if (extraType === 'leg_bye') {
      const extraVal = lastBall.extras || 0;
      innings.extras.legByes = Math.max(0, innings.extras.legByes - extraVal);
      innings.extras.total = Math.max(0, innings.extras.total - extraVal);
    }

    // Reverse batsman stats
    const batsman = innings.batsmen.find(b => b.playerId?.toString() === lastBall.batsmanId?.toString());
    if (batsman) {
      batsman.runs -= lastBall.runs;
      if (wasLegal) batsman.balls -= 1;
      if (lastBall.runs === 4) batsman.fours -= 1;
      if (lastBall.runs === 6) batsman.sixes -= 1;
      batsman.strikeRate = batsman.balls > 0 ? parseFloat(((batsman.runs / batsman.balls) * 100).toFixed(2)) : 0;
      if (lastBall.isWicket) {
        batsman.isOut = false;
        batsman.dismissalType = undefined;
        innings.totalWickets -= 1;
        innings.fallOfWickets.pop();
      }
    }

    // Reverse bowler stats
    const bowler = innings.bowlers.find(b => b.playerId?.toString() === lastBall.bowlerId?.toString());
    if (bowler) {
      bowler.runs -= lastBall.runs + totalExtras;
      if (lastBall.isWicket && lastBall.wicket?.type !== 'run_out') bowler.wickets -= 1;
      if (extraType === 'wide') bowler.wides = Math.max(0, (bowler.wides || 0) - 1);
      if (extraType === 'no_ball') bowler.noBalls = Math.max(0, (bowler.noBalls || 0) - 1);
    }

    // Remove the ball
    lastOver.balls.pop();
    if (lastOver.balls.length === 0) {
      innings.overs.pop();
    }

    // Recalculate bowler overs and economy
    if (bowler) {
      bowler.overs = liveScore.currentOver + (liveScore.currentBall > 0 ? liveScore.currentBall / 10 : 0);
      bowler.economyRate = bowler.overs > 0 ? parseFloat((bowler.runs / bowler.overs).toFixed(2)) : 0;
    }

    liveScore.lastUpdated = new Date();
    liveScore.markModified('innings');
    await liveScore.save();

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('score-correction', { matchId, liveScore, undoneBall: lastBall });

    res.json({ success: true, data: { liveScore, undoneBall: lastBall } });
  } catch (err) {
    next(err);
  }
};
