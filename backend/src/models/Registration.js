import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Player is required'],
    },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: [true, 'Tournament is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

registrationSchema.index({ tournamentId: 1 });
registrationSchema.index({ playerId: 1 });
registrationSchema.index({ playerId: 1, tournamentId: 1 }, { unique: true });

const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
