import Team from '../models/Team.js';
import Player from '../models/Player.js';
import Tournament from '../models/Tournament.js';
import User from '../models/User.js';

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

// Sensible squad-size defaults per sport. Admins can still override maxPlayers
// explicitly at create time or via edit later.
const DEFAULT_MAX_PLAYERS_BY_SPORT = {
  cricket: 15,   // 11 on the field + 4 on the bench
  football: 18,  // 11 on the field + 7 subs (FIFA-style)
  badminton: 8,  // enough to cover all 5 events with a substitute or two
};

export const createTeam = async (req, res, next) => {
  try {
    const teamData = { ...req.body };
    // Extract the optional inline login payload — when present, we create a
    // real User (role=manager) that the team can use to log into the admin-app
    // and bid. Keep it off the teamData so it doesn't bleed into Mongoose.
    const managerAccount = teamData.managerAccount;
    delete teamData.managerAccount;

    // Support legacy 'budget' field by mapping to totalPoints/remainingPoints
    if (teamData.budget !== undefined && teamData.totalPoints === undefined) {
      teamData.totalPoints = teamData.budget;
      delete teamData.budget;
    }
    if (teamData.totalPoints !== undefined && teamData.remainingPoints === undefined) {
      teamData.remainingPoints = teamData.totalPoints;
    }

    // Create a login-capable manager User from managerAccount and wire it to
    // the team. Only runs when the admin filled the "Team Login Credentials"
    // section; existing teams that pick a pre-created managerId still work.
    let createdManagerUser = null;
    if (managerAccount && (managerAccount.email || managerAccount.password)) {
      const { name, email, password, phone } = managerAccount;
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Manager login requires name, email, and password',
        });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'A user with this email already exists — pick a different login email',
        });
      }
      createdManagerUser = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password, // hashed by pre-save hook
        phone,
        role: 'manager',
      });
      teamData.managerId = createdManagerUser._id;
    }

    // Prevent same manager managing two teams in the same tournament
    if (teamData.managerId && teamData.tournamentId) {
      const existing = await Team.findOne({ managerId: teamData.managerId, tournamentId: teamData.tournamentId });
      if (existing) {
        // Roll back the freshly-created User so re-submitting doesn't leave
        // an orphaned account behind.
        if (createdManagerUser) await User.findByIdAndDelete(createdManagerUser._id);
        return res.status(400).json({ success: false, message: 'This manager already has a team in this tournament' });
      }
    }
    // Sport-aware maxPlayers default when caller didn't specify one.
    // Model-level default is cricket-flavored (15), which is wrong for a badminton team.
    if (teamData.maxPlayers == null && teamData.tournamentId) {
      const tournament = await Tournament.findById(teamData.tournamentId).select('sport').lean();
      const sport = tournament?.sport || 'cricket';
      teamData.maxPlayers = DEFAULT_MAX_PLAYERS_BY_SPORT[sport] ?? 15;
    }
    try {
      const team = await Team.create(teamData);
      return res.status(201).json({
        success: true,
        data: {
          team,
          // Hand the credential summary back so the UI can confirm/display
          // them (without the password — it's already hashed at this point).
          managerLogin: createdManagerUser
            ? { email: createdManagerUser.email, name: createdManagerUser.name }
            : undefined,
        },
      });
    } catch (teamErr) {
      // Roll back the manager User if team creation blew up so we don't
      // leave a dangling login without a team.
      if (createdManagerUser) await User.findByIdAndDelete(createdManagerUser._id);
      throw teamErr;
    }
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
    // Backfill the tournamentId onto the player so ranking / stats queries that
    // filter by `Player.tournamentId` still find this player. Without this the
    // player would only be reachable via their team, and endpoints like
    // `getRankings` that start from the player collection would silently miss
    // them (was the root cause of "match finished but rank not displayed").
    if (team.tournamentId && !player.tournamentId) {
      player.tournamentId = team.tournamentId;
    }
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
    // Always filter by managerId = current user. Previously this only filtered
    // when req.user.type === 'admin', which left regular managers getting back
    // the first team in the tournament instead of their own.
    const filter = { managerId: req.user.id };
    if (tournamentId) filter.tournamentId = tournamentId;

    const team = await Team.findOne(filter)
      .populate('tournamentId', 'name format sport')
      .populate('managerId', 'name');
    if (!team) return res.status(404).json({ success: false, message: 'No team found' });
    res.json({ success: true, data: team });
  } catch (error) { next(error); }
};
