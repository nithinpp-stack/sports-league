import Match from '../models/Match.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Player from '../models/Player.js';
import LiveScore from '../models/LiveScore.js';
import { requiredPlayersForCategory } from '../validators/match.js';

// Ensure each supplied player belongs to the team they're listed for.
// Returns a user-facing error string if invalid; null if OK.
async function validateMatchPlayers(team1Players, team2Players, team1Id, team2Id) {
  const allIds = [...(team1Players || []), ...(team2Players || [])];
  if (allIds.length === 0) return null;
  // Must be distinct — no player on both sides
  if (new Set(allIds.map(String)).size !== allIds.length) {
    return 'Duplicate player: a player cannot appear twice in a match';
  }
  const players = await Player.find({ _id: { $in: allIds } }).select('_id teamId').lean();
  const byId = new Map(players.map((p) => [String(p._id), p]));
  for (const pid of (team1Players || [])) {
    const p = byId.get(String(pid));
    if (!p) return `Player ${pid} not found`;
    if (String(p.teamId) !== String(team1Id)) {
      return `Player ${pid} does not belong to team 1`;
    }
  }
  for (const pid of (team2Players || [])) {
    const p = byId.get(String(pid));
    if (!p) return `Player ${pid} not found`;
    if (String(p.teamId) !== String(team2Id)) {
      return `Player ${pid} does not belong to team 2`;
    }
  }
  return null;
}

export const listMatches = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.tournamentId) filter.tournamentId = req.query.tournamentId;
    if (req.query.status) filter.status = req.query.status;

    const [matches, total] = await Promise.all([
      Match.find(filter)
        .populate('team1Id', 'name logo')
        .populate('team2Id', 'name logo')
        .populate('tournamentId', 'name format sport')
        .populate('scorerId', 'name email')
        .populate('team1Players', 'name photo')
        .populate('team2Players', 'name photo')
        .skip(skip)
        .limit(limit)
        .sort({ date: 1 }),
      Match.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { matches },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const getMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .populate('tournamentId', 'name format sport')
      .populate('scorerId', 'name email')
      .populate('manOfMatch', 'name skill')
      .populate('bestBatsman', 'name skill')
      .populate('bestBowler', 'name skill')
      .populate('tossWinner', 'name')
      .populate('team1Players', 'name photo skill events')
      .populate('team2Players', 'name photo skill events');
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    return res.json({ success: true, data: { match } });
  } catch (err) {
    next(err);
  }
};

export const createMatch = async (req, res, next) => {
  try {
    const { team1Id, team2Id, tournamentId, category, team1Players, team2Players } = req.body;
    if (team1Id === team2Id) {
      return res.status(400).json({ success: false, message: 'team1Id and team2Id must be different' });
    }

    // For badminton, category is required (mens_singles, womens_singles, etc.)
    let tournamentSport = null;
    if (tournamentId) {
      const tournament = await Tournament.findById(tournamentId).select('sport status');
      tournamentSport = tournament?.sport || null;
      if (tournamentSport === 'badminton' && !category) {
        return res.status(400).json({
          success: false,
          message: 'Category is required for badminton matches',
          errors: [{ field: 'category', message: 'Pick a category (Men\'s Singles, Mixed Doubles, etc.)' }],
        });
      }
    }

    // Badminton: enforce player-count matches category and that players belong to their team
    if (tournamentSport === 'badminton' && category) {
      const expected = requiredPlayersForCategory(category);
      const t1 = Array.isArray(team1Players) ? team1Players : [];
      const t2 = Array.isArray(team2Players) ? team2Players : [];
      // Players are optional at create time (admin may assign later), but if provided must be complete & valid
      if (t1.length > 0 || t2.length > 0) {
        if (t1.length !== expected || t2.length !== expected) {
          return res.status(400).json({
            success: false,
            message: `Each side must have exactly ${expected} player(s) for ${category}`,
            errors: [{ field: 'team1Players', message: `Expected ${expected} player(s) per team` }],
          });
        }
        const membershipErr = await validateMatchPlayers(t1, t2, team1Id, team2Id);
        if (membershipErr) return res.status(400).json({ success: false, message: membershipErr });
      }
    }

    const match = await Match.create(req.body);

    // Auto-activate tournament when first match is created
    if (req.body.tournamentId) {
      await Tournament.findOneAndUpdate(
        { _id: req.body.tournamentId, status: { $in: ['draft', 'registration'] } },
        { status: 'active' }
      );
    }

    return res.status(201).json({ success: true, data: { match } });
  } catch (err) {
    next(err);
  }
};

export const updateMatch = async (req, res, next) => {
  try {
    // Block totalOvers change after first innings ended
    if (req.body.totalOvers != null) {
      const liveScore = await LiveScore.findOne({ matchId: req.params.id });
      if (liveScore && liveScore.currentInnings > 1) {
        return res.status(400).json({ success: false, message: 'Cannot change total overs after first innings has ended' });
      }
    }

    // If players are being updated, validate them against the match's category + teams
    if (req.body.team1Players || req.body.team2Players) {
      const current = await Match.findById(req.params.id).select('team1Id team2Id category tournamentId');
      if (!current) return res.status(404).json({ success: false, message: 'Match not found' });
      const category = req.body.category || current.category;
      if (category) {
        const expected = requiredPlayersForCategory(category);
        const t1 = Array.isArray(req.body.team1Players) ? req.body.team1Players : [];
        const t2 = Array.isArray(req.body.team2Players) ? req.body.team2Players : [];
        if (t1.length !== expected || t2.length !== expected) {
          return res.status(400).json({
            success: false,
            message: `Each side must have exactly ${expected} player(s) for ${category}`,
          });
        }
        const membershipErr = await validateMatchPlayers(
          t1,
          t2,
          req.body.team1Id || current.team1Id,
          req.body.team2Id || current.team2Id,
        );
        if (membershipErr) return res.status(400).json({ success: false, message: membershipErr });
      }
    }

    const match = await Match.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    return res.json({ success: true, data: { match } });
  } catch (err) {
    next(err);
  }
};

export const deleteMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    if (match.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Only upcoming matches can be deleted',
      });
    }
    await match.deleteOne();
    return res.json({ success: true, data: { message: 'Match deleted' } });
  } catch (err) {
    next(err);
  }
};

export const assignScorer = async (req, res, next) => {
  try {
    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { scorerId: req.body.scorerId },
      { new: true, runValidators: true }
    );
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    return res.json({ success: true, data: { match } });
  } catch (err) {
    next(err);
  }
};

export const generateMatches = async (req, res, next) => {
  try {
    const { tournamentId, format, venue, category } = req.body;
    // format: 'round_robin' or 'knockout'

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    // Badminton: category is required so every generated match is categorized
    if (tournament.sport === 'badminton' && !category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required when generating badminton matches',
        errors: [{ field: 'category', message: 'Pick a category (Men\'s Singles, Mixed Doubles, etc.)' }],
      });
    }

    const teams = await Team.find({ tournamentId });
    if (teams.length < 2) return res.status(400).json({ success: false, message: 'Need at least 2 teams' });

    // Shuffle teams randomly
    const shuffled = [...teams].sort(() => Math.random() - 0.5);

    const matchDocs = [];
    const startDate = tournament.startDate || new Date();

    if (format === 'round_robin') {
      // Every team plays every other team
      let matchIndex = 0;
      for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + matchIndex);
          matchDocs.push({
            tournamentId,
            team1Id: shuffled[i]._id,
            team2Id: shuffled[j]._id,
            date,
            venue: venue || tournament.venue || 'TBD',
            status: 'upcoming',
            ...(category ? { category } : {}),
          });
          matchIndex++;
        }
      }
    } else if (format === 'knockout') {
      // Pair up teams for first round
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + Math.floor(i / 2));
        matchDocs.push({
          tournamentId,
          team1Id: shuffled[i]._id,
          team2Id: shuffled[i + 1]._id,
          date,
          venue: venue || tournament.venue || 'TBD',
          status: 'upcoming',
          ...(category ? { category } : {}),
        });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Format must be round_robin or knockout' });
    }

    // Shuffle the order of matches
    matchDocs.sort(() => Math.random() - 0.5);

    const matches = await Match.insertMany(matchDocs);

    // Auto-activate tournament when matches are generated
    if (tournament.status === 'draft' || tournament.status === 'registration') {
      tournament.status = 'active';
      await tournament.save();
    }

    res.status(201).json({ success: true, data: { matches, count: matches.length } });
  } catch (error) { next(error); }
};

export const getLiveMatches = async (req, res, next) => {
  try {
    const matches = await Match.find({ status: 'live' })
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .populate('tournamentId', 'name format sport')
      .populate('team1Players', 'name photo')
      .populate('team2Players', 'name photo')
      .lean();

    // Attach compact live-score snapshots so the listing can display in-match scores
    // (e.g. cricket "145/3", badminton "12-9, Game 2") without an extra round-trip per card.
    const matchIds = matches.map((m) => m._id);
    const liveScores = await LiveScore.find({ matchId: { $in: matchIds } }).lean();
    const liveScoreByMatch = new Map(liveScores.map((ls) => [String(ls.matchId), ls]));

    const enriched = matches.map((m) => {
      const ls = liveScoreByMatch.get(String(m._id));
      if (!ls) return m;
      // Include only the sport-relevant snapshot to keep payload small
      const snapshot = {};
      if (ls.badmintonData) snapshot.badmintonData = ls.badmintonData;
      if (ls.currentInnings != null) snapshot.currentInnings = ls.currentInnings;
      if (ls.innings) snapshot.innings = ls.innings;
      if (ls.footballData) snapshot.footballData = ls.footballData;
      return { ...m, liveScore: snapshot };
    });

    return res.json({ success: true, data: { matches: enriched } });
  } catch (err) {
    next(err);
  }
};
