import Registration from '../models/Registration.js';
import Player from '../models/Player.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';

// GET /
export const listRegistrations = async (req, res, next) => {
  try {
    const { tournamentId, status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (tournamentId) filter.tournamentId = tournamentId;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [registrations, total] = await Promise.all([
      Registration.find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ appliedAt: -1 })
        .populate('playerId', 'name email role')
        .populate('tournamentId', 'name format status')
        .populate('reviewedBy', 'name email'),
      Registration.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        registrations,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// PUT /:id
export const reviewRegistration = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }

    const registration = await Registration.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      { new: true }
    )
      .populate('playerId', 'name email role')
      .populate('tournamentId', 'name format status')
      .populate('reviewedBy', 'name email');

    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    if (status === 'approved') {
      const user = registration.playerId ? await User.findById(registration.playerId) : null;
      const tournament = await Tournament.findById(registration.tournamentId);
      const sport = registration.sport || tournament?.sport || 'cricket';
      const defaultSkill = sport === 'football' ? 'midfielder' : 'batsman';

      const playerQuery = registration.playerId
        ? { userId: registration.playerId, tournamentId: registration.tournamentId }
        : { name: registration.name, tournamentId: registration.tournamentId };
      const existingPlayer = await Player.findOne(playerQuery);
      if (!existingPlayer) {
        await Player.create({
          name: registration.name || user?.name || 'Unknown',
          ...(registration.playerId && { userId: registration.playerId }),
          tournamentId: registration.tournamentId,
          sport,
          skill: registration.skill || defaultSkill,
          status: 'available',
          ...(registration.photo && { photo: registration.photo }),
          ...(registration.age && { age: registration.age }),
          ...(registration.phone && { phone: registration.phone }),
          ...(!registration.phone && user?.phone && { phone: user.phone }),
          ...(registration.battingStyle && { battingStyle: registration.battingStyle }),
          ...(registration.bowlingStyle && { bowlingStyle: registration.bowlingStyle }),
        });
      }
    }

    res.json({ success: true, data: registration });
  } catch (err) {
    next(err);
  }
};
