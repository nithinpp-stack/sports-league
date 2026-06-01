import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import User from '../models/User.js';
import env from '../config/env.js';

// Roles from the User collection that are allowed to log into the admin-app.
// Everyone else (players, unrelated users) stays out even if they POST here.
const MANAGER_ROLES = ['manager', 'team_owner'];

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

// Team managers live in the User collection (not Admin) and their JWT is tagged
// `type: 'user'` so downstream middleware (permit/authorize) can tell them apart.
const generateUserAccessToken = (user) =>
  jwt.sign(
    { id: user._id, email: user.email, role: user.role, type: 'user' },
    env.jwtSecret,
    { expiresIn: env.jwtExpire }
  );

const generateUserRefreshToken = (user) =>
  jwt.sign({ id: user._id, type: 'user' }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpire });

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Try the Admin collection first (original behaviour).
    const admin = await Admin.findOne({ email }).select('+password').populate('roleId');
    if (admin && admin.isActive && (await admin.comparePassword(password))) {
      const accessToken = generateAccessToken(admin);
      const refreshToken = generateRefreshToken(admin);
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true, secure: env.nodeEnv === 'production', sameSite: env.nodeEnv === 'production' ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return res.json({ success: true, data: { user: admin, accessToken } });
    }

    // 2) Fall back to User collection for team managers so they can use the
    //    admin-app for bidding. Restricted to MANAGER_ROLES — the login should
    //    not become a back-door for players/event-managers.
    const user = await User.findOne({ email }).select('+password');
    if (user && user.isActive && MANAGER_ROLES.includes(user.role) && (await user.comparePassword(password))) {
      const accessToken = generateUserAccessToken(user);
      const refreshToken = generateUserRefreshToken(user);
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true, secure: env.nodeEnv === 'production', sameSite: env.nodeEnv === 'production' ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return res.json({ success: true, data: { user, accessToken } });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) { next(error); }
};

export const adminGetMe = async (req, res, next) => {
  try {
    // Split by token `type` so we fetch from the right collection. Both shapes
    // are shipped back under `data.user` so the admin-app doesn't care.
    if (req.user?.type === 'user') {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, data: { user } });
    }
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
    if (decoded.type === 'user') {
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive || !MANAGER_ROLES.includes(user.role)) {
        return res.status(401).json({ success: false, message: 'Invalid refresh token' });
      }
      return res.json({ success: true, data: { accessToken: generateUserAccessToken(user) } });
    }
    if (decoded.type !== 'admin') return res.status(401).json({ success: false, message: 'Invalid token type' });
    const admin = await Admin.findById(decoded.id).populate('roleId');
    if (!admin || !admin.isActive) return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    const accessToken = generateAccessToken(admin);
    res.json({ success: true, data: { accessToken } });
  } catch (error) { return res.status(401).json({ success: false, message: 'Invalid refresh token' }); }
};

export const adminLogout = async (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true, secure: env.nodeEnv === 'production', sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
  });
  res.json({ success: true, data: { message: 'Logged out successfully' } });
};
