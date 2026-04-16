import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';

export const listTournaments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.sport) filter.sport = req.query.sport;
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }
    // Scope tournaments for non-super-admin users
    if (req.user?.type === 'admin') {
      const Admin = (await import('../models/Admin.js')).default;
      const admin = await Admin.findById(req.user.id).populate('roleId');
      const perms = [...(admin?.roleId?.permissions || []), ...(admin?.permissions || [])];
      if (!perms.includes('*')) {
        filter.createdBy = req.user.id;
      }
    }

    const [tournaments, total] = await Promise.all([
      Tournament.find(filter)
        .populate('createdBy', 'name email')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Tournament.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { tournaments },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const getTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate('createdBy', 'name email');
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    return res.json({ success: true, data: { tournament } });
  } catch (err) {
    next(err);
  }
};

export const createTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.create({
      ...req.body,
      createdBy: req.user.id,
    });
    return res.status(201).json({ success: true, data: { tournament } });
  } catch (err) {
    next(err);
  }
};

export const updateTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    const hasWildcard = req.adminRole?.permissions?.includes('*');
    if (!hasWildcard && tournament.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only manage your own tournaments' });
    }
    const updated = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    return res.json({ success: true, data: { tournament: updated } });
  } catch (err) {
    next(err);
  }
};

export const deleteTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    const hasWildcard = req.adminRole?.permissions?.includes('*');
    if (!hasWildcard && tournament.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only manage your own tournaments' });
    }
    if (tournament.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft tournaments can be deleted',
      });
    }
    await tournament.deleteOne();
    return res.json({ success: true, data: { message: 'Tournament deleted' } });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    const hasWildcard = req.adminRole?.permissions?.includes('*');
    if (!hasWildcard && tournament.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only manage your own tournaments' });
    }
    const updated = await Tournament.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    return res.json({ success: true, data: { tournament: updated } });
  } catch (err) {
    next(err);
  }
};

export const getTournamentTeams = async (req, res, next) => {
  try {
    const teams = await Team.find({ tournamentId: req.params.id }).populate('managerId', 'name email');
    return res.json({ success: true, data: { teams } });
  } catch (err) {
    next(err);
  }
};

export const getTournamentMatches = async (req, res, next) => {
  try {
    const matches = await Match.find({ tournamentId: req.params.id })
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .sort({ date: 1 });
    return res.json({ success: true, data: { matches } });
  } catch (err) {
    next(err);
  }
};

export const getStandings = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const sport = tournament.sport || 'cricket';

    const matches = await Match.find({
      tournamentId: req.params.id,
      status: 'completed',
    })
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo');

    const standingsMap = {};

    for (const match of matches) {
      const t1 = match.team1Id?._id?.toString();
      const t2 = match.team2Id?._id?.toString();
      if (!t1 || !t2) continue;

      if (!standingsMap[t1]) {
        if (sport === 'football') {
          standingsMap[t1] = { team: match.team1Id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
        } else {
          standingsMap[t1] = { team: match.team1Id, played: 0, won: 0, lost: 0, noResult: 0, points: 0 };
        }
      }
      if (!standingsMap[t2]) {
        if (sport === 'football') {
          standingsMap[t2] = { team: match.team2Id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
        } else {
          standingsMap[t2] = { team: match.team2Id, played: 0, won: 0, lost: 0, noResult: 0, points: 0 };
        }
      }

      standingsMap[t1].played += 1;
      standingsMap[t2].played += 1;

      const winnerId = match.result?.winner?.toString();
      const winType = match.result?.winType;

      if (sport === 'football') {
        const homeGoals = match.result?.homeGoals ?? 0;
        const awayGoals = match.result?.awayGoals ?? 0;

        standingsMap[t1].goalsFor += homeGoals;
        standingsMap[t1].goalsAgainst += awayGoals;
        standingsMap[t2].goalsFor += awayGoals;
        standingsMap[t2].goalsAgainst += homeGoals;

        if (winType === 'draw' || (!winnerId && winType !== 'no_result')) {
          standingsMap[t1].drawn += 1;
          standingsMap[t2].drawn += 1;
          standingsMap[t1].points += 1;
          standingsMap[t2].points += 1;
        } else if (winnerId === t1) {
          standingsMap[t1].won += 1;
          standingsMap[t2].lost += 1;
          standingsMap[t1].points += 3;
        } else if (winnerId === t2) {
          standingsMap[t2].won += 1;
          standingsMap[t1].lost += 1;
          standingsMap[t2].points += 3;
        }

        standingsMap[t1].goalDifference = standingsMap[t1].goalsFor - standingsMap[t1].goalsAgainst;
        standingsMap[t2].goalDifference = standingsMap[t2].goalsFor - standingsMap[t2].goalsAgainst;
      } else {
        if (winType === 'no_result') {
          standingsMap[t1].noResult += 1;
          standingsMap[t2].noResult += 1;
          standingsMap[t1].points += 1;
          standingsMap[t2].points += 1;
        } else if (winnerId === t1) {
          standingsMap[t1].won += 1;
          standingsMap[t2].lost += 1;
          standingsMap[t1].points += 2;
        } else if (winnerId === t2) {
          standingsMap[t2].won += 1;
          standingsMap[t1].lost += 1;
          standingsMap[t2].points += 2;
        } else if (winType === 'tie') {
          standingsMap[t1].noResult += 1;
          standingsMap[t2].noResult += 1;
          standingsMap[t1].points += 1;
          standingsMap[t2].points += 1;
        }
      }
    }

    let standings;
    if (sport === 'football') {
      standings = Object.values(standingsMap).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.goalDifference - a.goalDifference;
      });
    } else {
      standings = Object.values(standingsMap).sort((a, b) => b.points - a.points);
    }

    return res.json({ success: true, data: { standings, sport } });
  } catch (err) {
    next(err);
  }
};
