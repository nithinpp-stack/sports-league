import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import env from './config/env.js';
import errorHandler from './middleware/errorHandler.js';
import adminAuthRoutes from './routes/adminAuth.js';
import adminUserRoutes from './routes/adminUsers.js';
import roleRoutes from './routes/roles.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import tournamentRoutes from './routes/tournaments.js';
import teamRoutes from './routes/teams.js';
import playerRoutes from './routes/players.js';
import matchRoutes from './routes/matches.js';
import liveScoreRoutes from './routes/livescores.js';
import auctionRoutes from './routes/auctions.js';
import dashboardRoutes from './routes/dashboard.js';
import registrationRoutes from './routes/registrations.js';
import uploadRoutes from './routes/upload.js';
import managerRoutes from './routes/managers.js';
import adsRoutes from './routes/ads.js';

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Logging (dev only)
if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// One-time seed endpoint (creates super admin if not exists)
app.post('/api/seed-admin', async (req, res) => {
  try {
    const Admin = (await import('./models/Admin.js')).default;
    const Role = (await import('./models/Role.js')).default;
    const existing = await Admin.findOne({ email: 'admin@sportsleague.com' });
    if (existing) return res.json({ success: true, message: 'Already seeded' });
    const role = await Role.findOneAndUpdate(
      { name: 'Super Admin' },
      { name: 'Super Admin', level: 1, status: 'active', permissions: ['*', 'dashboard.access'], isDefault: true },
      { upsert: true, new: true }
    );
    await Role.findOneAndUpdate(
      { name: 'Event Manager' },
      { name: 'Event Manager', level: 2, status: 'active', isDefault: true, permissions: ['dashboard.access','tournaments.view','tournaments.create','tournaments.edit','tournaments.delete','teams.view','teams.create','teams.edit','teams.delete','managers.view','managers.create','managers.delete','players.view','players.create','players.edit','players.assign','matches.view','matches.create','matches.edit','matches.delete','matches.score','auctions.view','auctions.manage','admins.view','admins.create','admins.edit','admins.delete'] },
      { upsert: true, new: true }
    );
    await Admin.create({ name: 'Admin User', email: 'admin@sportsleague.com', password: 'admin123', roleId: role._id });
    res.json({ success: true, message: 'Super admin created' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/roles', roleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/livescores', liveScoreRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/ads', adsRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Error handler (must be last)
app.use(errorHandler);

export default app;
