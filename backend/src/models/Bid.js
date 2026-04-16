import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction',
      required: [true, 'Auction is required'],
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: [true, 'Player is required'],
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Bid amount is required'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

bidSchema.index({ auctionId: 1 });
bidSchema.index({ playerId: 1 });

const Bid = mongoose.model('Bid', bidSchema);
export default Bid;
