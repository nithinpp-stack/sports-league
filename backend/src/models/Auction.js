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
    // Ascending call order — Marquee=0, Capped=1, Uncapped=2, … . When the
    // current set runs out, nextPlayer() auto-advances to the set with the
    // next-highest order that still has remaining players.
    order: { type: Number, default: 0 },
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
    // Soft floor — teams under this at end-auction time surface as a warning
    // on the admin UI; we don't hard-block because the admin may intentionally
    // end a shortened draft (e.g. mini-tournament). Default 11 = minimum fielded
    // side in cricket. Caller can override at startAuction time.
    minSquadSize: {
      type: Number,
      default: 11,
    },
  },
  { timestamps: true }
);

auctionSchema.index({ tournamentId: 1 });

const Auction = mongoose.model('Auction', auctionSchema);
export default Auction;
