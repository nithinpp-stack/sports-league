import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
    },
    logo: {
      type: String,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Manager',
    },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: [true, 'Tournament is required'],
    },
    totalPoints: {
      type: Number,
      default: 1000,
    },
    remainingPoints: {
      type: Number,
      default: 1000,
    },
    playerCount: {
      type: Number,
      default: 0,
    },
    maxPlayers: {
      type: Number,
      default: 15,
    },
  },
  { timestamps: true }
);

teamSchema.index({ tournamentId: 1 });
teamSchema.index({ managerId: 1 });
teamSchema.index(
  { managerId: 1, tournamentId: 1 },
  { unique: true, partialFilterExpression: { managerId: { $exists: true, $ne: null } } }
);

const Team = mongoose.model('Team', teamSchema);
export default Team;
