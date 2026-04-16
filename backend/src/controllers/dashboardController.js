import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';
import Player from '../models/Player.js';

// GET /admin/stats
export const getAdminStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalTournaments,
      totalTeams,
      totalMatches,
      totalPlayers,
      liveMatches,
      activeTournaments,
    ] = await Promise.all([
      User.countDocuments(),
      Tournament.countDocuments(),
      Team.countDocuments(),
      Match.countDocuments(),
      Player.countDocuments(),
      Match.countDocuments({ status: 'live' }),
      Tournament.countDocuments({ status: 'active' }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalTournaments,
        totalTeams,
        totalMatches,
        totalPlayers,
        liveMatches,
        activeTournaments,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/recent-activity
export const getRecentActivity = async (req, res, next) => {
  try {
    const [recentMatches, recentTournaments, recentUsers] = await Promise.all([
      Match.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('team1Id', 'name')
        .populate('team2Id', 'name')
        .populate('tournamentId', 'name'),
      Tournament.find().sort({ createdAt: -1 }).limit(5),
      User.find().sort({ createdAt: -1 }).limit(5).select('-password'),
    ]);

    res.json({
      success: true,
      data: { recentMatches, recentTournaments, recentUsers },
    });
  } catch (err) {
    next(err);
  }
};

// GET /team/:teamId
export const getTeamDashboard = async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const [team, players, matches] = await Promise.all([
      Team.findById(teamId).populate('tournamentId', 'name format status'),
      Player.find({ teamId }),
      Match.find({ $or: [{ team1Id: teamId }, { team2Id: teamId }] })
        .populate('team1Id', 'name')
        .populate('team2Id', 'name')
        .sort({ date: -1 }),
    ]);

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const wins = matches.filter(
      m => m.status === 'completed' && m.result?.winner?.toString() === teamId
    ).length;
    const losses = matches.filter(
      m => m.status === 'completed' && m.result?.winner && m.result.winner.toString() !== teamId
    ).length;

    res.json({
      success: true,
      data: {
        team,
        players,
        matches,
        stats: {
          totalMatches: matches.length,
          wins,
          losses,
          noResult: matches.filter(m => m.status === 'completed' && !m.result?.winner).length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
