import Player from '../models/Player.js';
import Registration from '../models/Registration.js';
import LiveScore from '../models/LiveScore.js';
import Match from '../models/Match.js';
import Team from '../models/Team.js';

export const listPlayers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.tournamentId) filter.tournamentId = req.query.tournamentId;
    if (req.query.teamId) filter.teamId = req.query.teamId;
    if (req.query.skill) filter.skill = req.query.skill;
    if (req.query.sport) filter.sport = req.query.sport;
    if (req.query.status) filter.status = req.query.status;
    // `unassigned=true` narrows to the free-agent pool (no team). Useful for
    // the "Assign Existing" dropdown on a tournament page, which wants every
    // available shuttler/batsman in the system that isn't already on a team.
    if (req.query.unassigned === 'true') filter.teamId = null;
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }

    const [players, total] = await Promise.all([
      Player.find(filter)
        .populate('teamId', 'name logo')
        .populate('tournamentId', 'name format')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Player.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { players },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const getPlayer = async (req, res, next) => {
  try {
    const player = await Player.findById(req.params.id)
      .populate('teamId', 'name logo')
      .populate('tournamentId', 'name format sport');
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }
    return res.json({ success: true, data: { player } });
  } catch (err) {
    next(err);
  }
};

export const createPlayer = async (req, res, next) => {
  try {
    if (req.body.userId && req.body.tournamentId) {
      const existing = await Player.findOne({ userId: req.body.userId, tournamentId: req.body.tournamentId });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Player already exists in this tournament' });
      }
    }
    const player = await Player.create(req.body);
    return res.status(201).json({ success: true, data: { player } });
  } catch (err) {
    next(err);
  }
};

export const updatePlayer = async (req, res, next) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const isAdminType = req.user.type === 'admin';
    const isSelf = player.userId && player.userId.toString() === req.user.id;

    if (!isAdminType && !isSelf) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this player' });
    }

    // Merge-then-save so the pre('validate') hook runs and strips cross-sport fields
    // (e.g. clearing battingStyle when a player is updated to sport='football').
    // findByIdAndUpdate skips pre-validate hooks, which defeats that safety net.
    //
    // `tournamentId` is allowed so the tournament page's "Add Existing" flow can
    // attach a free-agent/cross-tournament player via a lightweight PUT body like
    // `{ tournamentId, status: 'available' }`. Without this field in the allow
    // list the PUT silently dropped `tournamentId` and the player never joined
    // the tournament (UI showed "Players (0)" after a seemingly-successful add).
    const ALLOWED_FIELDS = [
      'name', 'sport', 'skill', 'age', 'battingStyle', 'bowlingStyle', 'events',
      'address', 'phone', 'photo', 'basePoints', 'basePrice', 'teamId',
      'tournamentId', 'status',
    ];
    for (const key of ALLOWED_FIELDS) {
      if (key in req.body) player[key] = req.body[key];
    }
    await player.save();

    return res.json({ success: true, data: { player } });
  } catch (err) {
    next(err);
  }
};

export const getPlayerStats = async (req, res, next) => {
  try {
    const { id: playerId } = req.params;
    const { tournamentId } = req.query;

    // LiveScore has no tournamentId — find matches first, then their live scores
    let matchIds = [];
    if (tournamentId) {
      const matches = await Match.find({ tournamentId }, '_id').lean();
      matchIds = matches.map(m => m._id);
    }
    const liveScoreQuery = matchIds.length ? { matchId: { $in: matchIds } } : {};
    const liveScores = await LiveScore.find(liveScoreQuery).lean();

    const pid = playerId.toString();

    let batting = { matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0, highestScore: 0, notOuts: 0, dismissals: 0 };
    let bowling = { innings: 0, overs: 0, runs: 0, wickets: 0, maidens: 0 };
    let fielding = { catches: 0 };

    for (const ls of liveScores) {
      for (const inn of (ls.innings || [])) {
        const batEntry = (inn.batsmen || []).find(b => b.playerId?.toString() === pid);
        if (batEntry) {
          batting.matches += 1;
          batting.innings += 1;
          batting.runs += batEntry.runs || 0;
          batting.balls += batEntry.balls || 0;
          batting.fours += batEntry.fours || 0;
          batting.sixes += batEntry.sixes || 0;
          if ((batEntry.runs || 0) > batting.highestScore) batting.highestScore = batEntry.runs || 0;
          if (!batEntry.isOut) batting.notOuts += 1;
          else batting.dismissals += 1;
        }

        const bowlEntry = (inn.bowlers || []).find(b => b.playerId?.toString() === pid);
        if (bowlEntry) {
          bowling.innings += 1;
          bowling.overs += bowlEntry.overs || 0;
          bowling.runs += bowlEntry.runs || 0;
          bowling.wickets += bowlEntry.wickets || 0;
          bowling.maidens += bowlEntry.maidens || 0;
        }

        // Count catches from dismissals
        for (const ball of (inn.overs || []).flatMap(o => o.balls || [])) {
          if (ball.isWicket && ball.wicket?.dismissalType === 'caught' && ball.wicket?.bowlerId?.toString() !== pid) {
            if (ball.bowlerId?.toString() === pid || ball.wicket?.batsmanId?.toString() !== pid) {
              // rough catch detection — if dismissed by catch and this player is mentioned
            }
          }
        }
      }
    }

    const dismissals = batting.dismissals || 1;
    const average = batting.dismissals > 0 ? parseFloat((batting.runs / batting.dismissals).toFixed(2)) : batting.runs || 0;
    const strikeRate = batting.balls > 0 ? parseFloat(((batting.runs / batting.balls) * 100).toFixed(1)) : 0;
    const bowlingAvg = bowling.wickets > 0 ? parseFloat((bowling.runs / bowling.wickets).toFixed(2)) : null;
    const economy = bowling.overs > 0 ? parseFloat((bowling.runs / bowling.overs).toFixed(2)) : 0;

    return res.json({
      success: true,
      data: {
        stats: {
          matches: batting.matches || bowling.innings,
          runs: batting.runs,
          balls: batting.balls,
          fours: batting.fours,
          sixes: batting.sixes,
          highestScore: batting.highestScore,
          average,
          strikeRate,
          wickets: bowling.wickets,
          bowlingOvers: parseFloat(bowling.overs.toFixed(1)),
          bowlingRuns: bowling.runs,
          bowlingAverage: bowlingAvg,
          economyRate: economy,
          maidens: bowling.maidens,
          catches: fielding.catches,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const registerForTournament = async (req, res, next) => {
  try {
    const { tournamentId } = req.body;

    // Find the player associated with this user
    const player = await Player.findOne({ userId: req.user.id });
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player profile not found for this user' });
    }

    // Check for existing registration
    const existing = await Registration.findOne({
      playerId: player._id,
      tournamentId,
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already registered for this tournament' });
    }

    const registration = await Registration.create({
      playerId: player._id,
      tournamentId,
    });

    return res.status(201).json({ success: true, data: { registration } });
  } catch (err) {
    next(err);
  }
};

// GET /players/:id/matches — match history with per-match performance
export const getPlayerMatches = async (req, res, next) => {
  try {
    const playerId = req.params.id;

    // Find all livescores where player appears in any innings
    const liveScores = await LiveScore.find({
      'innings.batsmen.playerId': playerId,
    }).populate('matchId');

    const liveScoresBowl = await LiveScore.find({
      'innings.bowlers.playerId': playerId,
    }).populate('matchId');

    // Merge into unique match map
    const matchMap = new Map();
    [...liveScores, ...liveScoresBowl].forEach(ls => {
      if (!ls.matchId) return;
      const mId = ls.matchId._id.toString();
      if (!matchMap.has(mId)) matchMap.set(mId, ls);
    });

    // Get full match details with populates
    const matchIds = [...matchMap.keys()];
    const matches = await Match.find({ _id: { $in: matchIds } })
      .populate('team1Id', 'name')
      .populate('team2Id', 'name')
      .populate('tournamentId', 'name format sport status')
      .sort({ date: -1 });

    // Build per-match performance
    const result = matches.map(match => {
      const ls = matchMap.get(match._id.toString());
      let batting = null, bowling = null;

      if (ls?.innings) {
        for (const inn of ls.innings) {
          const bat = (inn.batsmen || []).find(b => String(b.playerId) === playerId);
          if (bat) {
            batting = {
              runs: bat.runs, balls: bat.balls, fours: bat.fours, sixes: bat.sixes,
              isOut: bat.isOut, dismissalType: bat.dismissalType,
              strikeRate: bat.balls > 0 ? ((bat.runs / bat.balls) * 100).toFixed(1) : '0.0',
            };
          }
          const bowl = (inn.bowlers || []).find(b => String(b.playerId) === playerId);
          if (bowl) {
            bowling = {
              overs: typeof bowl.overs === 'number' ? parseFloat(bowl.overs.toFixed(1)) : bowl.overs,
              maidens: bowl.maidens, runs: bowl.runs, wickets: bowl.wickets,
              economyRate: bowl.overs > 0 ? parseFloat((bowl.runs / bowl.overs).toFixed(1)) : 0,
            };
          }
        }
      }

      const awards = [];
      if (String(match.manOfMatch) === playerId) awards.push('Man of Match');
      if (String(match.bestBatsman) === playerId) awards.push('Best Batsman');
      if (String(match.bestBowler) === playerId) awards.push('Best Bowler');

      return {
        _id: match._id,
        date: match.date,
        status: match.status,
        team1: match.team1Id,
        team2: match.team2Id,
        tournament: match.tournamentId,
        result: match.result,
        batting,
        bowling,
        awards,
      };
    });

    res.json({ success: true, data: { matches: result } });
  } catch (err) {
    next(err);
  }
};

export const publicRegister = async (req, res, next) => {
  try {
    const { name, tournamentId, skill, age, phone, sport, photo, battingStyle, bowlingStyle } = req.body;

    if (!name || !tournamentId) {
      return res.status(400).json({ success: false, message: 'Name and tournament are required' });
    }

    // Check for duplicate registration by name + tournament
    const existing = await Registration.findOne({ name: name.trim(), tournamentId, status: { $ne: 'rejected' } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already registered for this tournament' });
    }

    const registration = await Registration.create({
      name: name.trim(),
      tournamentId,
      skill,
      age: age ? Number(age) : undefined,
      phone,
      sport,
      photo,
      battingStyle,
      bowlingStyle,
      status: 'pending',
    });

    return res.status(201).json({ success: true, data: { registration }, message: 'Registration submitted! Awaiting admin approval.' });
  } catch (err) {
    next(err);
  }
};

// GET /players/:id/achievements — award counts and details
export const getPlayerAchievements = async (req, res, next) => {
  try {
    const playerId = req.params.id;

    const [momMatches, bestBatMatches, bestBowlMatches] = await Promise.all([
      Match.find({ manOfMatch: playerId })
        .populate('team1Id', 'name').populate('team2Id', 'name')
        .populate('tournamentId', 'name').sort({ date: -1 }),
      Match.find({ bestBatsman: playerId })
        .populate('team1Id', 'name').populate('team2Id', 'name')
        .populate('tournamentId', 'name').sort({ date: -1 }),
      Match.find({ bestBowler: playerId })
        .populate('team1Id', 'name').populate('team2Id', 'name')
        .populate('tournamentId', 'name').sort({ date: -1 }),
    ]);

    const fmt = (m) => ({
      _id: m._id, date: m.date,
      team1: m.team1Id, team2: m.team2Id,
      tournament: m.tournamentId,
    });

    res.json({
      success: true,
      data: {
        manOfMatch: { count: momMatches.length, matches: momMatches.map(fmt) },
        bestBatsman: { count: bestBatMatches.length, matches: bestBatMatches.map(fmt) },
        bestBowler: { count: bestBowlMatches.length, matches: bestBowlMatches.map(fmt) },
      },
    });
  } catch (err) {
    next(err);
  }
};
