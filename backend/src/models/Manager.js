import mongoose from 'mongoose';

const managerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

managerSchema.index({ tournamentId: 1 });
managerSchema.index({ email: 1, tournamentId: 1 });

const Manager = mongoose.model('Manager', managerSchema);
export default Manager;
