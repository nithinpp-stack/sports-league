import Team from '../models/Team.js';
import Player from '../models/Player.js';

export const listTeams = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.tournamentId) filter.tournamentId = req.query.tournamentId;
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }

    const [teams, total] = await Promise.all([
      Team.find(filter)
        .populate('managerId', 'name email')
        .populate('tournamentId', 'name format')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Team.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { teams },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const getTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('managerId', 'name email')
      .populate('tournamentId', 'name format');
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    return res.json({ success: true, data: { team } });
  } catch (err) {
    next(err);
  }
};

export const createTeam = async (req, res, next) => {
  try {
    const teamData = { ...req.body };
    // Support legacy 'budget' field by mapping to totalPoints/remainingPoints
    if (teamData.budget !== undefined && teamData.totalPoints === undefined) {
      teamData.totalPoints = teamData.budget;
      delete teamData.budget;
    }
    if (teamData.totalPoints !== undefined && teamData.remainingPoints === undefined) {
      teamData.remainingPoints = teamData.totalPoints;
    }
    // Prevent same manager managing two teams in the same tournament
    if (teamData.managerId && teamData.tournamentId) {
      const existing = await Team.findOne({ managerId: teamData.managerId, tournamentId: teamData.tournamentId });
      if (existing) {
        return res.status(400).json({ success: false, message: 'This manager already has a team in this tournament' });
      }
    }
    const team = await Team.create(teamData);
    return res.status(201).json({ success: true, data: { team } });
  } catch (err) {
    next(err);
  }
};

export const updateTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const hasWildcard = req.adminRole?.permissions?.includes('*');
    const isManager = team.managerId && team.managerId.toString() === req.user.id;

    if (!hasWildcard && !isManager) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this team' });
    }

    const updated = await Team.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    return res.json({ success: true, data: { team: updated } });
  } catch (err) {
    next(err);
  }
};

export const deleteTeam = async (req, res, next) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    return res.json({ success: true, data: { message: 'Team deleted' } });
  } catch (err) {
    next(err);
  }
};

export const getTeamPlayers = async (req, res, next) => {
  try {
    const players = await Player.find({ teamId: req.params.id });
    return res.json({ success: true, data: { players } });
  } catch (err) {
    next(err);
  }
};

export const assignPlayer = async (req, res, next) => {
  try {
    const { id } = req.params; // team ID
    const { playerId } = req.body;

    const team = await Team.findById(id);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const hasWildcard = req.adminRole?.permissions?.includes('*');
    const isTeamManager = team.managerId && team.managerId.toString() === req.user.id;
    if (!hasWildcard && !isTeamManager) {
      return res.status(403).json({ success: false, message: 'Not authorized to assign players to this team' });
    }

    if (team.playerCount >= team.maxPlayers) {
      return res.status(400).json({ success: false, message: 'Squad is full' });
    }

    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });

    if (player.teamId) {
      return res.status(400).json({ success: false, message: 'Player is already assigned to a team' });
    }

    player.teamId = id;
    player.status = 'sold';
    await player.save();

    team.playerCount += 1;
    await team.save();

    res.json({ success: true, data: { player, team } });
  } catch (error) { next(error); }
};

export const removePlayer = async (req, res, next) => {
  try {
    const { id } = req.params; // team ID
    const { playerId } = req.body;

    const team = await Team.findById(id);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const hasWildcard = req.adminRole?.permissions?.includes('*');
    const isTeamManager = team.managerId && team.managerId.toString() === req.user.id;
    if (!hasWildcard && !isTeamManager) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });

    if (!player.teamId || player.teamId.toString() !== id) {
      return res.status(400).json({ success: false, message: 'Player is not in this team' });
    }

    player.teamId = null;
    player.status = 'available';
    await player.save();

    if (team.playerCount > 0) team.playerCount -= 1;
    await team.save();

    res.json({ success: true, data: { player, team } });
  } catch (error) { next(error); }
};

export const getMyTeam = async (req, res, next) => {
  try {
    const { tournamentId } = req.query;
    const filter = {};
    if (req.user?.type === 'admin') {
      filter.managerId = req.user.id;
    }
    if (tournamentId) filter.tournamentId = tournamentId;

    const team = await Team.findOne(filter)
      .populate('tournamentId', 'name format sport')
      .populate('managerId', 'name');
    if (!team) return res.status(404).json({ success: false, message: 'No team found' });
    res.json({ success: true, data: team });
  } catch (error) { next(error); }
};
