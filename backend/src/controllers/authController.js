import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Player from '../models/Player.js';
import env from '../config/env.js';

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, type: 'user' },
    env.jwtSecret,
    { expiresIn: env.jwtExpire }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpire,
  });
};

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, address } = req.body;
    const userRole = 'player';

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const user = await User.create({ name, email, password, role: userRole, ...(phone && { phone }) });

    if (user.role === 'player') {
      await Player.create({
        name: user.name,
        userId: user._id,
        skill: 'batsman',
        status: 'registered',
        ...(phone && { phone }),
        ...(address && { address }),
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, cookieOptions);

    return res.status(201).json({
      success: true,
      data: { user, accessToken },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Remove password from output
    const userObj = user.toJSON();

    return res.json({
      success: true,
      data: { user: userObj, accessToken },
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtRefreshSecret);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    const accessToken = generateAccessToken(user);

    return res.json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    res.clearCookie('refreshToken', cookieOptions);
    return res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};
