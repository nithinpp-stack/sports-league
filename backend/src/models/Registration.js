import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: [true, 'Tournament is required'],
    },
    name: { type: String, required: true, trim: true },
    photo: { type: String },
    skill: { type: String },
    age: { type: Number },
    phone: { type: String },
    sport: { type: String },
    battingStyle: { type: String },
    bowlingStyle: { type: String },
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
registrationSchema.index({ name: 1, tournamentId: 1 });

const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
