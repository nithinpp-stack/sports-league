import mongoose from 'mongoose';

const adSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  imageUrl: { type: String },
  placement: { type: String, enum: ['popup', 'banner', 'strip', 'inline'], required: true },
  targetUrl: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['active', 'paused', 'expired'], default: 'active' },
  sport: { type: String, enum: ['all', 'cricket', 'football', 'badminton'], default: 'all' },
  priority: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

adSchema.index({ status: 1, placement: 1 });

export default mongoose.model('Ad', adSchema);
