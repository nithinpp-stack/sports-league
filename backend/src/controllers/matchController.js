import Match from '../models/Match.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';

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
      .populate('tossWinner', 'name');
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
    const { team1Id, team2Id } = req.body;
    if (team1Id === team2Id) {
      return res.status(400).json({ success: false, message: 'team1Id and team2Id must be different' });
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
      const LiveScore = (await import('../models/LiveScore.js')).default;
      const liveScore = await LiveScore.findOne({ matchId: req.params.id });
      if (liveScore && liveScore.currentInnings > 1) {
        return res.status(400).json({ success: false, message: 'Cannot change total overs after first innings has ended' });
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
    const { tournamentId, format, venue } = req.body;
    // format: 'round_robin' or 'knockout'

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

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
      .populate('tournamentId', 'name format sport');
    return res.json({ success: true, data: { matches } });
  } catch (err) {
    next(err);
  }
};
