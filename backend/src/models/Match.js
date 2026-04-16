import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema(
  {
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    winType: {
      type: String,
      enum: ['runs', 'wickets', 'tie', 'no_result', 'goals', 'penalties', 'draw'],
    },
    winMargin: {
      type: Number,
    },
    summary: {
      type: String,
    },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: [true, 'Tournament is required'],
    },
    team1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team 1 is required'],
    },
    team2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team 2 is required'],
    },
    date: {
      type: Date,
      required: [true, 'Match date is required'],
    },
    venue: {
      type: String,
    },
    totalOvers: {
      type: Number,
      default: 20,
    },
    status: {
      type: String,
      enum: ['upcoming', 'live', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    tossWinner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    tossDecision: {
      type: String,
      enum: ['bat', 'bowl'],
    },
    result: {
      type: resultSchema,
      default: () => ({}),
    },
    scorerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    manOfMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
    },
    bestBatsman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
    },
    bestBowler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
    },
  },
  { timestamps: true }
);

matchSchema.index({ tournamentId: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ date: 1 });
matchSchema.index({ scorerId: 1 });

const Match = mongoose.model('Match', matchSchema);
export default Match;
