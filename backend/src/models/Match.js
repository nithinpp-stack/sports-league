import mongoose from 'mongoose';

const gameScoreSchema = new mongoose.Schema(
  {
    gameNumber: { type: Number },
    team1Points: { type: Number },
    team2Points: { type: Number },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    winType: {
      type: String,
      enum: ['runs', 'wickets', 'tie', 'no_result', 'goals', 'penalties', 'draw', 'points'],
    },
    winMargin: {
      type: Number,
    },
    summary: {
      type: String,
    },
    // Per-game scores for badminton (game 1, 2, optional 3)
    scores: { type: [gameScoreSchema], default: undefined },
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
    // Badminton: which specific players are on court for this match.
    // Length must match the category (1 for singles, 2 for doubles/mixed).
    // Unused for cricket/football (full team playing).
    team1Players: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
      default: [],
    },
    team2Players: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
      default: [],
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
    category: {
      type: String,
      enum: ['mens_singles', 'womens_singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'],
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
      // Cricket toss: bat / bowl.
      // Badminton toss (coin or shuttle): serve / receive / side.
      type: String,
      enum: ['bat', 'bowl', 'serve', 'receive', 'side'],
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
