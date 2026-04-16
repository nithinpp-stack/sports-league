import mongoose from 'mongoose';

const batsmanSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    isOut: { type: Boolean, default: false },
    dismissalType: {
      type: String,
      enum: [
        'bowled',
        'caught',
        'lbw',
        'run_out',
        'stumped',
        'hit_wicket',
        'obstructing_field',
        'timed_out',
        'handled_ball',
        'retired_hurt',
      ],
    },
    dismissedBy: { type: String },
    strikeRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const bowlerSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    overs: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    wides: { type: Number, default: 0 },
    economyRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const wicketSchema = new mongoose.Schema(
  {
    ballNumber: { type: Number },
    batsmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    bowlerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    dismissalType: { type: String },
  },
  { _id: false }
);

const ballSchema = new mongoose.Schema(
  {
    ballNumber: { type: Number },
    batsmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    bowlerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    runs: { type: Number, default: 0 },
    extras: { type: Number, default: 0 },
    extraType: { type: String, default: 'none' },
    isWicket: { type: Boolean, default: false },
    wicket: { type: wicketSchema },
    commentary: { type: String },
  },
  { _id: false }
);

const overSchema = new mongoose.Schema(
  {
    overNumber: { type: Number },
    bowlerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    balls: { type: [ballSchema], default: [] },
  },
  { _id: false }
);

const extrasSchema = new mongoose.Schema(
  {
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    byes: { type: Number, default: 0 },
    legByes: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const fallOfWicketSchema = new mongoose.Schema(
  {
    wicketNumber: { type: Number },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    runs: { type: Number },
    overs: { type: Number },
  },
  { _id: false }
);

const inningsSchema = new mongoose.Schema(
  {
    inningsNumber: { type: Number },
    battingTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    bowlingTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    totalRuns: { type: Number, default: 0 },
    totalWickets: { type: Number, default: 0 },
    totalOvers: { type: Number, default: 0 },
    extras: { type: extrasSchema, default: () => ({}) },
    batsmen: { type: [batsmanSchema], default: [] },
    bowlers: { type: [bowlerSchema], default: [] },
    overs: { type: [overSchema], default: [] },
    fallOfWickets: { type: [fallOfWicketSchema], default: [] },
  },
  { _id: false }
);

const footballGoalSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  assistedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  minute: Number,
  half: { type: String, enum: ['1st', '2nd', 'ET1', 'ET2'] },
  isOwnGoal: { type: Boolean, default: false },
  isPenalty: { type: Boolean, default: false },
}, { _id: false });

const footballCardSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  cardType: { type: String, enum: ['yellow', 'red'], required: true },
  minute: Number,
  half: String,
  reason: String,
}, { _id: false });

const footballSubstitutionSchema = new mongoose.Schema({
  playerOutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  playerInId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  minute: Number,
  half: String,
}, { _id: false });

const footballDataSchema = new mongoose.Schema({
  homeTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  awayTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  homeGoals: { type: Number, default: 0 },
  awayGoals: { type: Number, default: 0 },
  currentHalf: { type: String, enum: ['not_started', '1st', 'half_time', '2nd', 'full_time', 'ET1', 'ET2', 'penalties'], default: 'not_started' },
  currentMinute: { type: Number, default: 0 },
  goals: [footballGoalSchema],
  cards: [footballCardSchema],
  substitutions: [footballSubstitutionSchema],
  penaltyShootout: {
    home: [Boolean],
    away: [Boolean],
  },
}, { _id: false });

const liveScoreSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: [true, 'Match is required'],
      unique: true,
    },
    sport: {
      type: String,
      enum: ['cricket', 'football'],
      default: 'cricket',
    },
    currentInnings: { type: Number, default: 1 },
    currentOver: { type: Number, default: 0 },
    currentBall: { type: Number, default: 0 },
    battingTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    bowlingTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    innings: { type: [inningsSchema], default: [] },
    footballData: { type: footballDataSchema },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

liveScoreSchema.index({ matchId: 1 });

const LiveScore = mongoose.model('LiveScore', liveScoreSchema);
export default LiveScore;
