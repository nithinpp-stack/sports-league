import mongoose from 'mongoose';

const footballStatsSchema = new mongoose.Schema(
  {
    matches: { type: Number, default: 0 },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 },
    cleanSheets: { type: Number, default: 0 },
    minutesPlayed: { type: Number, default: 0 },
  },
  { _id: false }
);

const badmintonStatsSchema = new mongoose.Schema(
  {
    matches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    pointsWon: { type: Number, default: 0 },
    pointsLost: { type: Number, default: 0 },
    bestRally: { type: Number, default: 0 },
  },
  { _id: false }
);

const statsSchema = new mongoose.Schema(
  {
    matches: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    catches: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    bestBowling: { type: String, default: '0/0' },
    average: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 },
    economyRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Player name is required'],
      trim: true,
    },
    age: {
      type: Number,
    },
    sport: {
      type: String,
      enum: ['cricket', 'football', 'badminton'],
      default: 'cricket',
    },
    skill: {
      type: String,
      enum: ['batsman', 'bowler', 'allrounder', 'wicketkeeper', 'goalkeeper', 'defender', 'midfielder', 'forward', 'shuttler'],
      required: [true, 'Skill is required'],
    },
    // Cricket-only: swing/stance. Validated via pre-validate hook so non-cricket players
    // can't get accidentally-stored values that leak into the UI.
    battingStyle: {
      type: String,
      enum: ['right-hand', 'left-hand'],
    },
    bowlingStyle: {
      type: String,
      enum: ['fast', 'medium', 'spin', 'none'],
    },
    // Badminton-only: which events this player competes in. Drives eligibility for
    // Men's Singles vs Mixed Doubles etc. when assigning players to a match.
    events: {
      type: [
        {
          type: String,
          enum: ['mens_singles', 'womens_singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'],
        },
      ],
      default: undefined,
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    photo: {
      type: String,
    },
    basePoints: {
      type: Number,
      default: 10,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['available', 'sold', 'unsold', 'registered'],
      default: 'available',
    },
    stats: {
      type: statsSchema,
      default: () => ({}),
    },
    footballStats: {
      type: footballStatsSchema,
    },
    badmintonStats: {
      type: badmintonStatsSchema,
    },
  },
  { timestamps: true }
);

// Prevent cross-sport field contamination — e.g. a football player saved with a
// bowlingStyle, or a cricket player saved with badminton events. If the document is
// for a different sport, silently drop the mismatched fields before validation.
playerSchema.pre('validate', function stripCrossSportFields(next) {
  const s = this.sport;
  if (s !== 'cricket') {
    this.battingStyle = undefined;
    this.bowlingStyle = undefined;
  }
  if (s !== 'badminton') {
    this.events = undefined;
  }
  next();
});

playerSchema.index({ tournamentId: 1 });
playerSchema.index({ teamId: 1 });
playerSchema.index({ status: 1 });
playerSchema.index({ userId: 1 });
playerSchema.index(
  { userId: 1, tournamentId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true, $ne: null }, tournamentId: { $exists: true, $ne: null } } }
);

const Player = mongoose.model('Player', playerSchema);
export default Player;
