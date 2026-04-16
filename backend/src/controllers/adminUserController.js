import Admin from '../models/Admin.js';
import Role from '../models/Role.js';

export const listAdmins = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const filter = {};
    if (role) {
      // Find role by name (case-insensitive) to get its ID
      const roleDoc = await Role.findOne({ name: { $regex: new RegExp(`^${role}$`, 'i') } });
      if (roleDoc) {
        filter.roleId = roleDoc._id;
      } else {
        // No matching role found — return empty
        return res.json({ success: true, data: { users: [] }, pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
      }
    }
    if (search) filter.name = { $regex: search, $options: 'i' };
    const total = await Admin.countDocuments(filter);
    const admins = await Admin.find(filter)
      .populate('roleId', 'name level status')
      .skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
    res.json({ success: true, data: { users: admins }, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

export const createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, roleId } = req.body;
    const existing = await Admin.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered' });
    const admin = await Admin.create({ name, email, password, roleId });
    res.status(201).json({ success: true, data: { user: admin } });
  } catch (error) { next(error); }
};

export const toggleAdminStatus = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    admin.isActive = !admin.isActive;
    await admin.save();
    res.json({ success: true, data: admin });
  } catch (error) { next(error); }
};
