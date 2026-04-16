import mongoose from 'mongoose';

const soldPlayerSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    amount: { type: Number },
  },
  { _id: false }
);

const playerSetSchema = new mongoose.Schema(
  {
    name: { type: String }, // e.g. 'Marquee', 'Capped', 'Uncapped'
    playerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  },
  { _id: false }
);

const auctionSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: [true, 'Tournament is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'live', 'paused', 'completed'],
      default: 'pending',
    },
    currentPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
    },
    currentBid: {
      type: Number,
      default: 0,
    },
    currentBidderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
    },
    timer: {
      type: Number,
      default: 0,
    },
    soldPlayers: {
      type: [soldPlayerSchema],
      default: [],
    },
    unsoldPlayers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
      },
    ],
    remainingPlayers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
      },
    ],
    // IPL-style fields
    playerSets: {
      type: [playerSetSchema],
      default: [],
    },
    currentSet: {
      type: String,
      default: '',
    },
    bidIncrement: {
      type: Number,
      default: 5,
    },
    goingOnce: {
      type: Boolean,
      default: false,
    },
    goingTwice: {
      type: Boolean,
      default: false,
    },
    maxSquadSize: {
      type: Number,
      default: 15,
    },
  },
  { timestamps: true }
);

auctionSchema.index({ tournamentId: 1 });

const Auction = mongoose.model('Auction', auctionSchema);
export default Auction;
