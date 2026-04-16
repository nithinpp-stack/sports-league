import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import env from '../config/env.js';

const generateAccessToken = (admin) => {
  return jwt.sign(
    { id: admin._id, email: admin.email, role: admin.roleId?.name || 'unknown', type: 'admin' },
    env.jwtSecret,
    { expiresIn: env.jwtExpire }
  );
};

const generateRefreshToken = (admin) => {
  return jwt.sign(
    { id: admin._id, type: 'admin' },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpire }
  );
};

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select('+password').populate('roleId');
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, data: { user: admin, accessToken } });
  } catch (error) { next(error); }
};

export const adminGetMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.user.id).populate('roleId');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    res.json({ success: true, data: { user: admin } });
  } catch (error) { next(error); }
};

export const adminRefresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });
    const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret);
    if (decoded.type !== 'admin') return res.status(401).json({ success: false, message: 'Invalid token type' });
    const admin = await Admin.findById(decoded.id).populate('roleId');
    if (!admin || !admin.isActive) return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    const accessToken = generateAccessToken(admin);
    res.json({ success: true, data: { accessToken } });
  } catch (error) { return res.status(401).json({ success: false, message: 'Invalid refresh token' }); }
};

export const adminLogout = async (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ success: true, data: { message: 'Logged out successfully' } });
};
