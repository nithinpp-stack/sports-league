import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Role name is required'], unique: true, trim: true },
    level: { type: Number, default: 1 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    permissions: [{ type: String }],
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roleSchema.index({ name: 1 });

const Role = mongoose.model('Role', roleSchema);
export default Role;
