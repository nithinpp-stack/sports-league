# Sports League & Tournament Management Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cricket-focused tournament management platform with live scoring, player auctions, and real-time updates.

**Architecture:** Monolith Express.js backend (port 5000) serving two React+Vite frontends — public app (port 3000) and admin dashboard (port 3001). MongoDB with Mongoose ODM. Socket.IO for real-time live scoring and auction bidding. JWT authentication with refresh tokens.

**Tech Stack:** Node.js, Express, Mongoose, Socket.IO, JWT, bcryptjs, React 18, Vite, TailwindCSS, React Query, React Router, Recharts

**Spec:** `docs/superpowers/specs/2026-04-13-sports-league-platform-design.md`

---

## Phase 1: Backend Foundation

### Task 1: Initialize Backend Project

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `package.json` (root)

- [ ] **Step 1: Create root package.json**

```bash
cd C:/laragon/www/sports-league
```

Create `package.json`:
```json
{
  "name": "sports-league",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:backend": "cd backend && npm run dev",
    "dev:public": "cd frontend/public-app && npm run dev",
    "dev:admin": "cd frontend/admin-app && npm run dev",
    "install:all": "cd backend && npm install && cd ../frontend/public-app && npm install && cd ../admin-app && npm install"
  }
}
```

- [ ] **Step 2: Initialize backend**

```bash
mkdir -p backend
cd backend
```

Create `backend/package.json`:
```json
{
  "name": "sports-league-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js",
    "seed": "node src/utils/seed.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "express-validator": "^7.2.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.7.0",
    "morgan": "^1.10.0",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.7"
  }
}
```

- [ ] **Step 3: Create environment files**

Create `backend/.env`:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sports-league
JWT_SECRET=sports-league-jwt-secret-dev-2026
JWT_EXPIRE=15m
JWT_REFRESH_SECRET=sports-league-refresh-secret-dev-2026
JWT_REFRESH_EXPIRE=7d
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

Create `backend/.env.example`:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sports-league
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRE=15m
JWT_REFRESH_SECRET=<your-refresh-secret>
JWT_REFRESH_EXPIRE=7d
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

Create `backend/.gitignore`:
```
node_modules/
.env
```

- [ ] **Step 4: Install dependencies**

```bash
cd C:/laragon/www/sports-league/backend && npm install
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: initialize backend project with dependencies"
```

---

### Task 2: Backend Config & App Setup

**Files:**
- Create: `backend/src/config/db.js`
- Create: `backend/src/config/env.js`
- Create: `backend/src/middleware/errorHandler.js`
- Create: `backend/src/app.js`
- Create: `backend/server.js`

- [ ] **Step 1: Create env config**

Create `backend/src/config/env.js`:
```javascript
import dotenv from 'dotenv';
dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '15m',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'],
};

export default env;
```

- [ ] **Step 2: Create database connection**

Create `backend/src/config/db.js`:
```javascript
import mongoose from 'mongoose';
import env from './env.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
```

- [ ] **Step 3: Create error handler middleware**

Create `backend/src/middleware/errorHandler.js`:
```javascript
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `Duplicate value for ${field}`,
      errors: [{ field, message: `${field} already exists` }],
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

export default errorHandler;
```

- [ ] **Step 4: Create Express app**

Create `backend/src/app.js`:
```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import env from './config/env.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.corsOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
```

- [ ] **Step 5: Create server entry point**

Create `backend/server.js`:
```javascript
import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import env from './src/config/env.js';

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible to routes
app.set('io', io);

const start = async () => {
  await connectDB();

  httpServer.listen(env.port, () => {
    console.log(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
  });
};

start();
```

- [ ] **Step 6: Verify server starts**

```bash
cd C:/laragon/www/sports-league/backend && npm run dev
```

Expected: `Server running on port 5000 in development mode` and `MongoDB connected: localhost`

Stop the server after verification.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add backend config, Express app, and server entry point"
```

---

### Task 3: Auth Middleware

**Files:**
- Create: `backend/src/middleware/auth.js`

- [ ] **Step 1: Create auth middleware**

Create `backend/src/middleware/auth.js`:
```javascript
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this action' });
    }

    next();
  };
};

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = decoded;
  } catch (error) {
    // Token invalid but endpoint is public — continue without user
  }

  next();
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add JWT auth and role authorization middleware"
```

---

### Task 4: Mongoose Models

**Files:**
- Create: `backend/src/models/User.js`
- Create: `backend/src/models/Tournament.js`
- Create: `backend/src/models/Team.js`
- Create: `backend/src/models/Player.js`
- Create: `backend/src/models/Match.js`
- Create: `backend/src/models/LiveScore.js`
- Create: `backend/src/models/Auction.js`
- Create: `backend/src/models/Bid.js`
- Create: `backend/src/models/Registration.js`

- [ ] **Step 1: Create User model**

Create `backend/src/models/User.js`:
```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
    role: {
      type: String,
      enum: ['super_admin', 'team_owner', 'player', 'scorer'],
      default: 'player',
    },
    phone: { type: String, trim: true },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
```

- [ ] **Step 2: Create Tournament model**

Create `backend/src/models/Tournament.js`:
```javascript
import mongoose from 'mongoose';

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Tournament name is required'], trim: true },
    sport: { type: String, default: 'cricket' },
    format: { type: String, enum: ['T20', 'ODI', 'Test'], required: true },
    location: { type: String, trim: true },
    venue: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'registration', 'active', 'completed', 'cancelled'],
      default: 'draft',
    },
    maxTeams: { type: Number, default: 8 },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

tournamentSchema.index({ status: 1 });
tournamentSchema.index({ createdBy: 1 });

const Tournament = mongoose.model('Tournament', tournamentSchema);
export default Tournament;
```

- [ ] **Step 3: Create Team model**

Create `backend/src/models/Team.js`:
```javascript
import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Team name is required'], trim: true },
    logo: { type: String },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    budget: { type: Number, default: 1000000 },
    remainingBudget: { type: Number, default: 1000000 },
    playerCount: { type: Number, default: 0 },
    maxPlayers: { type: Number, default: 15 },
  },
  { timestamps: true }
);

teamSchema.index({ tournamentId: 1 });
teamSchema.index({ ownerId: 1 });

const Team = mongoose.model('Team', teamSchema);
export default Team;
```

- [ ] **Step 4: Create Player model**

Create `backend/src/models/Player.js`:
```javascript
import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Player name is required'], trim: true },
    age: { type: Number },
    skill: {
      type: String,
      enum: ['batsman', 'bowler', 'allrounder', 'wicketkeeper'],
      required: true,
    },
    battingStyle: { type: String, enum: ['right-hand', 'left-hand'] },
    bowlingStyle: { type: String, enum: ['fast', 'medium', 'spin', 'none'] },
    basePrice: { type: Number, default: 50000 },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['available', 'sold', 'unsold', 'registered'],
      default: 'available',
    },
    stats: {
      matches: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      catches: { type: Number, default: 0 },
      highestScore: { type: Number, default: 0 },
      bestBowling: { type: String, default: '0/0' },
      average: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 },
      economyRate: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

playerSchema.index({ tournamentId: 1 });
playerSchema.index({ teamId: 1 });
playerSchema.index({ status: 1 });
playerSchema.index({ userId: 1 });

const Player = mongoose.model('Player', playerSchema);
export default Player;
```

- [ ] **Step 5: Create Match model**

Create `backend/src/models/Match.js`:
```javascript
import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    team1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    team2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    date: { type: Date, required: true },
    venue: { type: String, trim: true },
    status: {
      type: String,
      enum: ['upcoming', 'live', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    tossWinner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    tossDecision: { type: String, enum: ['bat', 'bowl'] },
    result: {
      winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      winType: { type: String, enum: ['runs', 'wickets', 'tie', 'no_result'] },
      winMargin: { type: Number },
      summary: { type: String },
    },
    scorerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    manOfMatch: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  },
  { timestamps: true }
);

matchSchema.index({ tournamentId: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ date: 1 });
matchSchema.index({ scorerId: 1 });

const Match = mongoose.model('Match', matchSchema);
export default Match;
```

- [ ] **Step 6: Create LiveScore model**

Create `backend/src/models/LiveScore.js`:
```javascript
import mongoose from 'mongoose';

const ballSchema = new mongoose.Schema({
  ballNumber: Number,
  batsmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  bowlerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  runs: { type: Number, default: 0 },
  extras: {
    type: { type: String, enum: ['wide', 'no_ball', 'bye', 'leg_bye', 'none'], default: 'none' },
    runs: { type: Number, default: 0 },
  },
  isWicket: { type: Boolean, default: false },
  wicket: {
    type: { type: String, enum: ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'retired'] },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    fielderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  },
  commentary: String,
}, { _id: false });

const overSchema = new mongoose.Schema({
  overNumber: Number,
  bowlerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  balls: [ballSchema],
}, { _id: false });

const batsmanEntrySchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  runs: { type: Number, default: 0 },
  balls: { type: Number, default: 0 },
  fours: { type: Number, default: 0 },
  sixes: { type: Number, default: 0 },
  isOut: { type: Boolean, default: false },
  dismissalType: { type: String, enum: ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'retired'] },
  dismissedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  strikeRate: { type: Number, default: 0 },
}, { _id: false });

const bowlerEntrySchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  overs: { type: Number, default: 0 },
  maidens: { type: Number, default: 0 },
  runs: { type: Number, default: 0 },
  wickets: { type: Number, default: 0 },
  noBalls: { type: Number, default: 0 },
  wides: { type: Number, default: 0 },
  economyRate: { type: Number, default: 0 },
}, { _id: false });

const fowSchema = new mongoose.Schema({
  wicketNumber: Number,
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  runs: Number,
  overs: Number,
}, { _id: false });

const inningsSchema = new mongoose.Schema({
  inningsNumber: Number,
  battingTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  bowlingTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  totalRuns: { type: Number, default: 0 },
  totalWickets: { type: Number, default: 0 },
  totalOvers: { type: Number, default: 0 },
  extras: {
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    byes: { type: Number, default: 0 },
    legByes: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  batsmen: [batsmanEntrySchema],
  bowlers: [bowlerEntrySchema],
  overs: [overSchema],
  fallOfWickets: [fowSchema],
}, { _id: false });

const liveScoreSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, unique: true },
    currentInnings: { type: Number, default: 1 },
    currentOver: { type: Number, default: 0 },
    currentBall: { type: Number, default: 0 },
    battingTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    bowlingTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    innings: [inningsSchema],
    lastUpdated: { type: Date, default: Date.now },
  }
);

liveScoreSchema.index({ matchId: 1 });

const LiveScore = mongoose.model('LiveScore', liveScoreSchema);
export default LiveScore;
```

- [ ] **Step 7: Create Auction, Bid, and Registration models**

Create `backend/src/models/Auction.js`:
```javascript
import mongoose from 'mongoose';

const auctionSchema = new mongoose.Schema(
  {
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    status: {
      type: String,
      enum: ['pending', 'live', 'paused', 'completed'],
      default: 'pending',
    },
    currentPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    currentBid: { type: Number, default: 0 },
    currentBidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    timer: { type: Number, default: 0 },
    soldPlayers: [{
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
      teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      amount: Number,
    }],
    unsoldPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    remainingPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  },
  { timestamps: true }
);

auctionSchema.index({ tournamentId: 1 });

const Auction = mongoose.model('Auction', auctionSchema);
export default Auction;
```

Create `backend/src/models/Bid.js`:
```javascript
import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema({
  auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

bidSchema.index({ auctionId: 1 });
bidSchema.index({ playerId: 1 });

const Bid = mongoose.model('Bid', bidSchema);
export default Bid;
```

Create `backend/src/models/Registration.js`:
```javascript
import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  appliedAt: { type: Date, default: Date.now },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
});

registrationSchema.index({ tournamentId: 1 });
registrationSchema.index({ playerId: 1 });

const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add all Mongoose models (User, Tournament, Team, Player, Match, LiveScore, Auction, Bid, Registration)"
```

---

## Phase 2: Authentication API

### Task 5: Auth Validators

**Files:**
- Create: `backend/src/validators/auth.js`
- Create: `backend/src/middleware/validate.js`

- [ ] **Step 1: Create validation middleware**

Create `backend/src/middleware/validate.js`:
```javascript
import { validationResult } from 'express-validator';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

export default validate;
```

- [ ] **Step 2: Create auth validators**

Create `backend/src/validators/auth.js`:
```javascript
import { body } from 'express-validator';

export const registerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['player', 'team_owner'])
    .withMessage('Role must be player or team_owner'),
];

export const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add validation middleware and auth validators"
```

---

### Task 6: Auth Controller & Routes

**Files:**
- Create: `backend/src/controllers/authController.js`
- Create: `backend/src/routes/auth.js`
- Modify: `backend/src/app.js` (add route)

- [ ] **Step 1: Create auth controller**

Create `backend/src/controllers/authController.js`:
```javascript
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import env from '../config/env.js';

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpire }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpire }
  );
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    const user = await User.create({ name, email, password, role: role || 'player' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      data: { user, accessToken },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: { user, accessToken },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token' });
    }

    const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const accessToken = generateAccessToken(user);

    res.json({ success: true, data: { accessToken } });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

export const logout = async (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ success: true, data: { message: 'Logged out successfully' } });
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 2: Create auth routes**

Create `backend/src/routes/auth.js`:
```javascript
import { Router } from 'express';
import { register, login, refresh, logout, getMe } from '../controllers/authController.js';
import { registerValidator, loginValidator } from '../validators/auth.js';
import validate from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerValidator, validate, register);
router.post('/login', loginValidator, validate, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

export default router;
```

- [ ] **Step 3: Register auth routes in app.js**

Add to `backend/src/app.js`, before the error handler line:

```javascript
import authRoutes from './routes/auth.js';

// Routes
app.use('/api/auth', authRoutes);
```

- [ ] **Step 4: Test auth endpoints**

Start server and test with curl:
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"test123","role":"player"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

Expected: 201 with user + accessToken for register, 200 with user + accessToken for login.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add auth controller and routes (register, login, refresh, logout, me)"
```

---

## Phase 3: Core CRUD APIs

### Task 7: User Management API

**Files:**
- Create: `backend/src/controllers/userController.js`
- Create: `backend/src/routes/users.js`
- Create: `backend/src/validators/user.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Create user validators**

Create `backend/src/validators/user.js`:
```javascript
import { body, param, query } from 'express-validator';

export const createScorerValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const updateUserValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().trim(),
  body('avatar').optional().trim(),
];

export const listUsersValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('role').optional().isIn(['super_admin', 'team_owner', 'player', 'scorer']),
];
```

- [ ] **Step 2: Create user controller**

Create `backend/src/controllers/userController.js`:
```javascript
import User from '../models/User.js';

export const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { name, phone, avatar } = req.body;
    const isAdmin = req.user.role === 'super_admin';
    const isSelf = req.user.id === req.params.id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const createScorer = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, role: 'scorer' });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Create user routes**

Create `backend/src/routes/users.js`:
```javascript
import { Router } from 'express';
import { listUsers, getUser, updateUser, deactivateUser, createScorer } from '../controllers/userController.js';
import { createScorerValidator, updateUserValidator, listUsersValidator } from '../validators/user.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize('super_admin'), listUsersValidator, validate, listUsers);
router.get('/:id', getUser);
router.put('/:id', updateUserValidator, validate, updateUser);
router.delete('/:id', authorize('super_admin'), deactivateUser);
router.post('/create-scorer', authorize('super_admin'), createScorerValidator, validate, createScorer);

export default router;
```

- [ ] **Step 4: Register route in app.js**

Add to `backend/src/app.js`:
```javascript
import userRoutes from './routes/users.js';
app.use('/api/users', userRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add user management API (list, get, update, deactivate, create-scorer)"
```

---

### Task 8: Tournament API

**Files:**
- Create: `backend/src/controllers/tournamentController.js`
- Create: `backend/src/routes/tournaments.js`
- Create: `backend/src/validators/tournament.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Create tournament validators**

Create `backend/src/validators/tournament.js`:
```javascript
import { body, param, query } from 'express-validator';

export const createTournamentValidator = [
  body('name').trim().notEmpty().withMessage('Tournament name is required'),
  body('format').isIn(['T20', 'ODI', 'Test']).withMessage('Format must be T20, ODI, or Test'),
  body('location').optional().trim(),
  body('venue').optional().trim(),
  body('startDate').optional().isISO8601().withMessage('Invalid start date'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date'),
  body('maxTeams').optional().isInt({ min: 2 }).withMessage('Max teams must be at least 2'),
  body('description').optional().trim(),
];

export const updateTournamentValidator = [
  param('id').isMongoId().withMessage('Invalid tournament ID'),
  body('name').optional().trim().notEmpty(),
  body('format').optional().isIn(['T20', 'ODI', 'Test']),
  body('location').optional().trim(),
  body('venue').optional().trim(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('maxTeams').optional().isInt({ min: 2 }),
  body('description').optional().trim(),
];

export const updateStatusValidator = [
  param('id').isMongoId().withMessage('Invalid tournament ID'),
  body('status').isIn(['draft', 'registration', 'active', 'completed', 'cancelled']).withMessage('Invalid status'),
];

export const listTournamentsValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['draft', 'registration', 'active', 'completed', 'cancelled']),
];
```

- [ ] **Step 2: Create tournament controller**

Create `backend/src/controllers/tournamentController.js`:
```javascript
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';

export const listTournaments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const total = await Tournament.countDocuments(filter);
    const tournaments = await Tournament.find(filter)
      .populate('createdBy', 'name email')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: tournaments,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate('createdBy', 'name email');
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    res.json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

export const createTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

export const updateTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    res.json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

export const deleteTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    if (tournament.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Can only delete draft tournaments' });
    }

    await Tournament.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: { message: 'Tournament deleted' } });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const tournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    res.json({ success: true, data: tournament });
  } catch (error) {
    next(error);
  }
};

export const getTournamentTeams = async (req, res, next) => {
  try {
    const teams = await Team.find({ tournamentId: req.params.id })
      .populate('ownerId', 'name email');
    res.json({ success: true, data: teams });
  } catch (error) {
    next(error);
  }
};

export const getTournamentMatches = async (req, res, next) => {
  try {
    const matches = await Match.find({ tournamentId: req.params.id })
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .sort({ date: 1 });
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};

export const getStandings = async (req, res, next) => {
  try {
    const teams = await Team.find({ tournamentId: req.params.id });
    const matches = await Match.find({ tournamentId: req.params.id, status: 'completed' });

    const standings = teams.map((team) => {
      const teamMatches = matches.filter(
        (m) => m.team1Id.toString() === team._id.toString() || m.team2Id.toString() === team._id.toString()
      );
      const wins = teamMatches.filter((m) => m.result?.winner?.toString() === team._id.toString()).length;
      const losses = teamMatches.filter(
        (m) => m.result?.winner && m.result.winner.toString() !== team._id.toString()
      ).length;
      const noResults = teamMatches.filter((m) => !m.result?.winner).length;

      return {
        team: { _id: team._id, name: team.name, logo: team.logo },
        played: teamMatches.length,
        wins,
        losses,
        noResults,
        points: wins * 2 + noResults,
      };
    });

    standings.sort((a, b) => b.points - a.points || b.wins - a.wins);

    res.json({ success: true, data: standings });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Create tournament routes**

Create `backend/src/routes/tournaments.js`:
```javascript
import { Router } from 'express';
import {
  listTournaments, getTournament, createTournament, updateTournament,
  deleteTournament, updateStatus, getTournamentTeams, getTournamentMatches, getStandings,
} from '../controllers/tournamentController.js';
import { createTournamentValidator, updateTournamentValidator, updateStatusValidator, listTournamentsValidator } from '../validators/tournament.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', listTournamentsValidator, validate, listTournaments);
router.get('/:id', getTournament);
router.get('/:id/teams', getTournamentTeams);
router.get('/:id/matches', getTournamentMatches);
router.get('/:id/standings', getStandings);

router.post('/', authenticate, authorize('super_admin'), createTournamentValidator, validate, createTournament);
router.put('/:id', authenticate, authorize('super_admin'), updateTournamentValidator, validate, updateTournament);
router.delete('/:id', authenticate, authorize('super_admin'), deleteTournament);
router.put('/:id/status', authenticate, authorize('super_admin'), updateStatusValidator, validate, updateStatus);

export default router;
```

- [ ] **Step 4: Register route in app.js**

Add to `backend/src/app.js`:
```javascript
import tournamentRoutes from './routes/tournaments.js';
app.use('/api/tournaments', tournamentRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add tournament API (CRUD, standings, teams, matches)"
```

---

### Task 9: Team API

**Files:**
- Create: `backend/src/controllers/teamController.js`
- Create: `backend/src/routes/teams.js`
- Create: `backend/src/validators/team.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Create team validators**

Create `backend/src/validators/team.js`:
```javascript
import { body, param, query } from 'express-validator';

export const createTeamValidator = [
  body('name').trim().notEmpty().withMessage('Team name is required'),
  body('tournamentId').isMongoId().withMessage('Valid tournament ID is required'),
  body('ownerId').optional().isMongoId().withMessage('Valid owner ID required'),
  body('budget').optional().isInt({ min: 0 }),
  body('logo').optional().trim(),
];

export const updateTeamValidator = [
  param('id').isMongoId().withMessage('Invalid team ID'),
  body('name').optional().trim().notEmpty(),
  body('logo').optional().trim(),
  body('budget').optional().isInt({ min: 0 }),
  body('ownerId').optional().isMongoId(),
];

export const listTeamsValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('tournamentId').optional().isMongoId(),
];
```

- [ ] **Step 2: Create team controller**

Create `backend/src/controllers/teamController.js`:
```javascript
import Team from '../models/Team.js';
import Player from '../models/Player.js';

export const listTeams = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tournamentId, search } = req.query;
    const filter = {};
    if (tournamentId) filter.tournamentId = tournamentId;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const total = await Team.countDocuments(filter);
    const teams = await Team.find(filter)
      .populate('ownerId', 'name email')
      .populate('tournamentId', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: teams,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('ownerId', 'name email')
      .populate('tournamentId', 'name');
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    res.json({ success: true, data: team });
  } catch (error) {
    next(error);
  }
};

export const createTeam = async (req, res, next) => {
  try {
    const teamData = { ...req.body };
    if (teamData.budget) teamData.remainingBudget = teamData.budget;
    const team = await Team.create(teamData);
    res.status(201).json({ success: true, data: team });
  } catch (error) {
    next(error);
  }
};

export const updateTeam = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const isAdmin = req.user.role === 'super_admin';
    const isOwner = team.ownerId?.toString() === req.user.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updated = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteTeam = async (req, res, next) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    res.json({ success: true, data: { message: 'Team deleted' } });
  } catch (error) {
    next(error);
  }
};

export const getTeamPlayers = async (req, res, next) => {
  try {
    const players = await Player.find({ teamId: req.params.id });
    res.json({ success: true, data: players });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Create team routes**

Create `backend/src/routes/teams.js`:
```javascript
import { Router } from 'express';
import { listTeams, getTeam, createTeam, updateTeam, deleteTeam, getTeamPlayers } from '../controllers/teamController.js';
import { createTeamValidator, updateTeamValidator, listTeamsValidator } from '../validators/team.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', listTeamsValidator, validate, listTeams);
router.get('/:id', getTeam);
router.get('/:id/players', getTeamPlayers);

router.post('/', authenticate, authorize('super_admin'), createTeamValidator, validate, createTeam);
router.put('/:id', authenticate, updateTeamValidator, validate, updateTeam);
router.delete('/:id', authenticate, authorize('super_admin'), deleteTeam);

export default router;
```

- [ ] **Step 4: Register route in app.js**

Add to `backend/src/app.js`:
```javascript
import teamRoutes from './routes/teams.js';
app.use('/api/teams', teamRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add team API (CRUD, roster listing)"
```

---

### Task 10: Player API

**Files:**
- Create: `backend/src/controllers/playerController.js`
- Create: `backend/src/routes/players.js`
- Create: `backend/src/validators/player.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Create player validators**

Create `backend/src/validators/player.js`:
```javascript
import { body, param, query } from 'express-validator';

export const createPlayerValidator = [
  body('name').trim().notEmpty().withMessage('Player name is required'),
  body('skill').isIn(['batsman', 'bowler', 'allrounder', 'wicketkeeper']).withMessage('Invalid skill'),
  body('age').optional().isInt({ min: 10, max: 70 }),
  body('battingStyle').optional().isIn(['right-hand', 'left-hand']),
  body('bowlingStyle').optional().isIn(['fast', 'medium', 'spin', 'none']),
  body('basePrice').optional().isInt({ min: 0 }),
  body('tournamentId').optional().isMongoId(),
  body('userId').optional().isMongoId(),
];

export const updatePlayerValidator = [
  param('id').isMongoId().withMessage('Invalid player ID'),
  body('name').optional().trim().notEmpty(),
  body('skill').optional().isIn(['batsman', 'bowler', 'allrounder', 'wicketkeeper']),
  body('age').optional().isInt({ min: 10, max: 70 }),
  body('battingStyle').optional().isIn(['right-hand', 'left-hand']),
  body('bowlingStyle').optional().isIn(['fast', 'medium', 'spin', 'none']),
  body('basePrice').optional().isInt({ min: 0 }),
];

export const registerTournamentValidator = [
  body('tournamentId').isMongoId().withMessage('Valid tournament ID is required'),
];

export const listPlayersValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('tournamentId').optional().isMongoId(),
  query('teamId').optional().isMongoId(),
  query('skill').optional().isIn(['batsman', 'bowler', 'allrounder', 'wicketkeeper']),
  query('status').optional().isIn(['available', 'sold', 'unsold', 'registered']),
];
```

- [ ] **Step 2: Create player controller**

Create `backend/src/controllers/playerController.js`:
```javascript
import Player from '../models/Player.js';
import Registration from '../models/Registration.js';

export const listPlayers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tournamentId, teamId, skill, status, search } = req.query;
    const filter = {};
    if (tournamentId) filter.tournamentId = tournamentId;
    if (teamId) filter.teamId = teamId;
    if (skill) filter.skill = skill;
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const total = await Player.countDocuments(filter);
    const players = await Player.find(filter)
      .populate('teamId', 'name logo')
      .populate('tournamentId', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: players,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getPlayer = async (req, res, next) => {
  try {
    const player = await Player.findById(req.params.id)
      .populate('teamId', 'name logo')
      .populate('tournamentId', 'name');
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });
    res.json({ success: true, data: player });
  } catch (error) {
    next(error);
  }
};

export const createPlayer = async (req, res, next) => {
  try {
    const player = await Player.create(req.body);
    res.status(201).json({ success: true, data: player });
  } catch (error) {
    next(error);
  }
};

export const updatePlayer = async (req, res, next) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });

    const isAdmin = req.user.role === 'super_admin';
    const isSelf = player.userId?.toString() === req.user.id;
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updated = await Player.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const registerForTournament = async (req, res, next) => {
  try {
    const { tournamentId } = req.body;

    const existing = await Registration.findOne({ playerId: req.user.id, tournamentId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already registered for this tournament' });
    }

    const registration = await Registration.create({
      playerId: req.user.id,
      tournamentId,
    });

    res.status(201).json({ success: true, data: registration });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Create player routes**

Create `backend/src/routes/players.js`:
```javascript
import { Router } from 'express';
import { listPlayers, getPlayer, createPlayer, updatePlayer, registerForTournament } from '../controllers/playerController.js';
import { createPlayerValidator, updatePlayerValidator, registerTournamentValidator, listPlayersValidator } from '../validators/player.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', listPlayersValidator, validate, listPlayers);
router.get('/:id', getPlayer);

router.post('/', authenticate, authorize('super_admin'), createPlayerValidator, validate, createPlayer);
router.put('/:id', authenticate, updatePlayerValidator, validate, updatePlayer);
router.post('/register-tournament', authenticate, authorize('player'), registerTournamentValidator, validate, registerForTournament);

export default router;
```

- [ ] **Step 4: Register route in app.js**

Add to `backend/src/app.js`:
```javascript
import playerRoutes from './routes/players.js';
app.use('/api/players', playerRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add player API (CRUD, tournament registration)"
```

---

### Task 11: Match API

**Files:**
- Create: `backend/src/controllers/matchController.js`
- Create: `backend/src/routes/matches.js`
- Create: `backend/src/validators/match.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Create match validators**

Create `backend/src/validators/match.js`:
```javascript
import { body, param, query } from 'express-validator';

export const createMatchValidator = [
  body('tournamentId').isMongoId().withMessage('Valid tournament ID is required'),
  body('team1Id').isMongoId().withMessage('Valid team 1 ID is required'),
  body('team2Id').isMongoId().withMessage('Valid team 2 ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('venue').optional().trim(),
];

export const updateMatchValidator = [
  param('id').isMongoId().withMessage('Invalid match ID'),
  body('date').optional().isISO8601(),
  body('venue').optional().trim(),
  body('tossWinner').optional().isMongoId(),
  body('tossDecision').optional().isIn(['bat', 'bowl']),
  body('manOfMatch').optional().isMongoId(),
];

export const assignScorerValidator = [
  param('id').isMongoId().withMessage('Invalid match ID'),
  body('scorerId').isMongoId().withMessage('Valid scorer ID is required'),
];

export const listMatchesValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('tournamentId').optional().isMongoId(),
  query('status').optional().isIn(['upcoming', 'live', 'completed', 'cancelled']),
];
```

- [ ] **Step 2: Create match controller**

Create `backend/src/controllers/matchController.js`:
```javascript
import Match from '../models/Match.js';

export const listMatches = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tournamentId, status } = req.query;
    const filter = {};
    if (tournamentId) filter.tournamentId = tournamentId;
    if (status) filter.status = status;

    const total = await Match.countDocuments(filter);
    const matches = await Match.find(filter)
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .populate('tournamentId', 'name format')
      .populate('scorerId', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ date: -1 });

    res.json({
      success: true,
      data: matches,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .populate('tournamentId', 'name format')
      .populate('scorerId', 'name')
      .populate('manOfMatch', 'name skill');
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
};

export const createMatch = async (req, res, next) => {
  try {
    const { team1Id, team2Id } = req.body;
    if (team1Id === team2Id) {
      return res.status(400).json({ success: false, message: 'Teams must be different' });
    }
    const match = await Match.create(req.body);
    res.status(201).json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
};

export const updateMatch = async (req, res, next) => {
  try {
    const match = await Match.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
};

export const deleteMatch = async (req, res, next) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    if (match.status !== 'upcoming') {
      return res.status(400).json({ success: false, message: 'Can only delete upcoming matches' });
    }
    await Match.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: { message: 'Match deleted' } });
  } catch (error) {
    next(error);
  }
};

export const assignScorer = async (req, res, next) => {
  try {
    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { scorerId: req.body.scorerId },
      { new: true }
    ).populate('scorerId', 'name');
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
};

export const getLiveMatches = async (req, res, next) => {
  try {
    const matches = await Match.find({ status: 'live' })
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .populate('tournamentId', 'name');
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Create match routes**

Create `backend/src/routes/matches.js`:
```javascript
import { Router } from 'express';
import { listMatches, getMatch, createMatch, updateMatch, deleteMatch, assignScorer, getLiveMatches } from '../controllers/matchController.js';
import { createMatchValidator, updateMatchValidator, assignScorerValidator, listMatchesValidator } from '../validators/match.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/live', getLiveMatches);
router.get('/', listMatchesValidator, validate, listMatches);
router.get('/:id', getMatch);

router.post('/', authenticate, authorize('super_admin'), createMatchValidator, validate, createMatch);
router.put('/:id', authenticate, authorize('super_admin'), updateMatchValidator, validate, updateMatch);
router.delete('/:id', authenticate, authorize('super_admin'), deleteMatch);
router.put('/:id/assign-scorer', authenticate, authorize('super_admin'), assignScorerValidator, validate, assignScorer);

export default router;
```

- [ ] **Step 4: Register route in app.js**

Add to `backend/src/app.js`:
```javascript
import matchRoutes from './routes/matches.js';
app.use('/api/matches', matchRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add match API (CRUD, assign scorer, live matches)"
```

---

## Phase 4: Live Scoring System

### Task 12: Live Score API & Socket.IO

**Files:**
- Create: `backend/src/controllers/liveScoreController.js`
- Create: `backend/src/routes/livescores.js`
- Create: `backend/src/socket/index.js`
- Create: `backend/src/socket/liveScoring.js`
- Modify: `backend/src/app.js`
- Modify: `backend/server.js`

- [ ] **Step 1: Create live score controller**

Create `backend/src/controllers/liveScoreController.js`:
```javascript
import LiveScore from '../models/LiveScore.js';
import Match from '../models/Match.js';

export const getLiveScore = async (req, res, next) => {
  try {
    const liveScore = await LiveScore.findOne({ matchId: req.params.matchId });
    if (!liveScore) return res.status(404).json({ success: false, message: 'Live score not found' });
    res.json({ success: true, data: liveScore });
  } catch (error) {
    next(error);
  }
};

export const getScorecard = async (req, res, next) => {
  try {
    const liveScore = await LiveScore.findOne({ matchId: req.params.matchId });
    if (!liveScore) return res.status(404).json({ success: false, message: 'Scorecard not found' });

    const match = await Match.findById(req.params.matchId)
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .populate('tournamentId', 'name');

    res.json({ success: true, data: { match, liveScore } });
  } catch (error) {
    next(error);
  }
};

export const startMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { battingTeamId, bowlingTeamId } = req.body;

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    const existing = await LiveScore.findOne({ matchId });
    if (existing) return res.status(400).json({ success: false, message: 'Scoring already started' });

    const liveScore = await LiveScore.create({
      matchId,
      currentInnings: 1,
      currentOver: 0,
      currentBall: 0,
      battingTeamId,
      bowlingTeamId,
      innings: [{
        inningsNumber: 1,
        battingTeamId,
        bowlingTeamId,
        totalRuns: 0,
        totalWickets: 0,
        totalOvers: 0,
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
        batsmen: [],
        bowlers: [],
        overs: [],
        fallOfWickets: [],
      }],
    });

    await Match.findByIdAndUpdate(matchId, { status: 'live' });

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('match-started', { matchId, liveScore });

    res.status(201).json({ success: true, data: liveScore });
  } catch (error) {
    next(error);
  }
};

export const recordBall = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { batsmanId, bowlerId, runs, extras, isWicket, wicket, commentary } = req.body;

    const liveScore = await LiveScore.findOne({ matchId });
    if (!liveScore) return res.status(404).json({ success: false, message: 'Live score not found' });

    const innings = liveScore.innings[liveScore.currentInnings - 1];
    const extraRuns = extras?.runs || 0;
    const extraType = extras?.type || 'none';
    const isLegalBall = extraType !== 'wide' && extraType !== 'no_ball';

    // Update ball count
    let ballNumber = liveScore.currentBall + 1;
    let overNumber = liveScore.currentOver;

    if (isLegalBall) {
      if (ballNumber > 6) {
        ballNumber = 1;
        overNumber += 1;
      }
    }

    // Build ball entry
    const ballEntry = {
      ballNumber: isLegalBall ? ballNumber : liveScore.currentBall,
      batsmanId,
      bowlerId,
      runs,
      extras: { type: extraType, runs: extraRuns },
      isWicket: isWicket || false,
      wicket: isWicket ? wicket : undefined,
      commentary,
    };

    // Find or create current over
    let currentOver = innings.overs.find((o) => o.overNumber === overNumber);
    if (!currentOver) {
      innings.overs.push({ overNumber, bowlerId, balls: [] });
      currentOver = innings.overs[innings.overs.length - 1];
    }
    currentOver.balls.push(ballEntry);

    // Update totals
    const totalBallRuns = runs + extraRuns;
    innings.totalRuns += totalBallRuns;
    if (isLegalBall) {
      innings.totalOvers = overNumber + (ballNumber / 10);
    }

    // Update extras
    if (extraType === 'wide') innings.extras.wides += extraRuns;
    if (extraType === 'no_ball') innings.extras.noBalls += extraRuns;
    if (extraType === 'bye') innings.extras.byes += extraRuns;
    if (extraType === 'leg_bye') innings.extras.legByes += extraRuns;
    if (extraType !== 'none') innings.extras.total += extraRuns;

    // Update batsman
    let batsman = innings.batsmen.find((b) => b.playerId.toString() === batsmanId);
    if (!batsman) {
      innings.batsmen.push({ playerId: batsmanId, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, strikeRate: 0 });
      batsman = innings.batsmen[innings.batsmen.length - 1];
    }
    if (isLegalBall) batsman.balls += 1;
    batsman.runs += runs;
    if (runs === 4) batsman.fours += 1;
    if (runs === 6) batsman.sixes += 1;
    batsman.strikeRate = batsman.balls > 0 ? parseFloat(((batsman.runs / batsman.balls) * 100).toFixed(2)) : 0;

    if (isWicket) {
      batsman.isOut = true;
      batsman.dismissalType = wicket.type;
      batsman.dismissedBy = wicket.fielderId || bowlerId;
      innings.totalWickets += 1;

      innings.fallOfWickets.push({
        wicketNumber: innings.totalWickets,
        playerId: batsmanId,
        runs: innings.totalRuns,
        overs: innings.totalOvers,
      });
    }

    // Update bowler
    let bowler = innings.bowlers.find((b) => b.playerId.toString() === bowlerId);
    if (!bowler) {
      innings.bowlers.push({ playerId: bowlerId, overs: 0, maidens: 0, runs: 0, wickets: 0, noBalls: 0, wides: 0, economyRate: 0 });
      bowler = innings.bowlers[innings.bowlers.length - 1];
    }
    bowler.runs += totalBallRuns;
    if (isWicket) bowler.wickets += 1;
    if (extraType === 'wide') bowler.wides += 1;
    if (extraType === 'no_ball') bowler.noBalls += 1;

    if (isLegalBall && ballNumber === 6) {
      bowler.overs += 1;
      // Check for maiden
      const overBalls = currentOver.balls.filter((b) => b.extras.type === 'none' || b.extras.type === 'bye' || b.extras.type === 'leg_bye');
      const overRuns = overBalls.reduce((sum, b) => sum + b.runs, 0);
      if (overRuns === 0) bowler.maidens += 1;
    }
    const bowlerOversDecimal = bowler.overs + (isLegalBall ? (ballNumber < 6 ? ballNumber / 10 : 0) : 0);
    const totalBowlerBalls = Math.floor(bowlerOversDecimal) * 6 + (bowlerOversDecimal % 1) * 10;
    bowler.economyRate = totalBowlerBalls > 0 ? parseFloat(((bowler.runs / totalBowlerBalls) * 6).toFixed(2)) : 0;

    // Update live score state
    if (isLegalBall) {
      if (ballNumber >= 6) {
        liveScore.currentOver = overNumber + 1;
        liveScore.currentBall = 0;
      } else {
        liveScore.currentOver = overNumber;
        liveScore.currentBall = ballNumber;
      }
    }

    liveScore.lastUpdated = new Date();
    await liveScore.save();

    // Emit socket event
    const io = req.app.get('io');
    const eventData = { matchId, ball: ballEntry, score: { totalRuns: innings.totalRuns, totalWickets: innings.totalWickets, totalOvers: innings.totalOvers }, over: overNumber, innings: liveScore.currentInnings };

    if (isWicket) {
      io.of('/live-scoring').to(`match:${matchId}`).emit('wicket', { ...eventData, batsman: batsmanId, bowler: bowlerId, type: wicket.type });
    } else {
      io.of('/live-scoring').to(`match:${matchId}`).emit('ball-update', eventData);
    }

    res.json({ success: true, data: liveScore });
  } catch (error) {
    next(error);
  }
};

export const endInnings = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { nextBattingTeamId, nextBowlingTeamId } = req.body;

    const liveScore = await LiveScore.findOne({ matchId });
    if (!liveScore) return res.status(404).json({ success: false, message: 'Live score not found' });

    // Create next innings
    liveScore.innings.push({
      inningsNumber: 2,
      battingTeamId: nextBattingTeamId,
      bowlingTeamId: nextBowlingTeamId,
      totalRuns: 0,
      totalWickets: 0,
      totalOvers: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      batsmen: [],
      bowlers: [],
      overs: [],
      fallOfWickets: [],
    });

    liveScore.currentInnings = 2;
    liveScore.currentOver = 0;
    liveScore.currentBall = 0;
    liveScore.battingTeamId = nextBattingTeamId;
    liveScore.bowlingTeamId = nextBowlingTeamId;
    liveScore.lastUpdated = new Date();

    await liveScore.save();

    const io = req.app.get('io');
    const inningsSummary = liveScore.innings[0];
    io.of('/live-scoring').to(`match:${matchId}`).emit('innings-end', {
      matchId,
      innings: 1,
      summary: { totalRuns: inningsSummary.totalRuns, totalWickets: inningsSummary.totalWickets, totalOvers: inningsSummary.totalOvers },
    });

    res.json({ success: true, data: liveScore });
  } catch (error) {
    next(error);
  }
};

export const endMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { winner, winType, winMargin, summary, manOfMatch } = req.body;

    const match = await Match.findByIdAndUpdate(matchId, {
      status: 'completed',
      result: { winner, winType, winMargin, summary },
      manOfMatch,
    }, { new: true });

    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });

    const liveScore = await LiveScore.findOne({ matchId });

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('match-end', {
      matchId,
      result: match.result,
      scorecard: liveScore,
    });

    res.json({ success: true, data: { match, liveScore } });
  } catch (error) {
    next(error);
  }
};

export const undoLastBall = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const liveScore = await LiveScore.findOne({ matchId });
    if (!liveScore) return res.status(404).json({ success: false, message: 'Live score not found' });

    const innings = liveScore.innings[liveScore.currentInnings - 1];
    if (innings.overs.length === 0) {
      return res.status(400).json({ success: false, message: 'No balls to undo' });
    }

    const lastOver = innings.overs[innings.overs.length - 1];
    if (lastOver.balls.length === 0) {
      innings.overs.pop();
      return res.status(400).json({ success: false, message: 'No balls to undo in current over' });
    }

    const removedBall = lastOver.balls.pop();

    // Reverse totals
    const totalBallRuns = removedBall.runs + (removedBall.extras?.runs || 0);
    innings.totalRuns -= totalBallRuns;

    const isLegalBall = removedBall.extras?.type === 'none' || !removedBall.extras?.type;

    if (removedBall.isWicket) {
      innings.totalWickets -= 1;
      innings.fallOfWickets.pop();

      const batsman = innings.batsmen.find((b) => b.playerId.toString() === removedBall.batsmanId.toString());
      if (batsman) {
        batsman.isOut = false;
        batsman.dismissalType = undefined;
        batsman.dismissedBy = undefined;
      }
    }

    // Update ball/over counters
    if (isLegalBall) {
      if (liveScore.currentBall === 0 && liveScore.currentOver > 0) {
        liveScore.currentOver -= 1;
        liveScore.currentBall = 5;
      } else {
        liveScore.currentBall -= 1;
      }
    }

    if (lastOver.balls.length === 0) {
      innings.overs.pop();
    }

    liveScore.lastUpdated = new Date();
    await liveScore.save();

    const io = req.app.get('io');
    io.of('/live-scoring').to(`match:${matchId}`).emit('score-correction', { matchId, correction: 'undo', liveScore });

    res.json({ success: true, data: liveScore });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 2: Create live score routes**

Create `backend/src/routes/livescores.js`:
```javascript
import { Router } from 'express';
import { getLiveScore, getScorecard, startMatch, recordBall, endInnings, endMatch, undoLastBall } from '../controllers/liveScoreController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/:matchId', getLiveScore);
router.get('/:matchId/scorecard', getScorecard);

router.post('/:matchId/start', authenticate, authorize('super_admin', 'scorer'), startMatch);
router.post('/:matchId/ball', authenticate, authorize('super_admin', 'scorer'), recordBall);
router.post('/:matchId/end-innings', authenticate, authorize('super_admin', 'scorer'), endInnings);
router.post('/:matchId/end-match', authenticate, authorize('super_admin', 'scorer'), endMatch);
router.post('/:matchId/undo', authenticate, authorize('super_admin', 'scorer'), undoLastBall);

export default router;
```

- [ ] **Step 3: Create Socket.IO setup**

Create `backend/src/socket/index.js`:
```javascript
import { setupLiveScoring } from './liveScoring.js';
import { setupAuction } from './auction.js';

export const setupSocketIO = (io) => {
  setupLiveScoring(io);
  setupAuction(io);

  console.log('Socket.IO namespaces registered');
};
```

Create `backend/src/socket/liveScoring.js`:
```javascript
export const setupLiveScoring = (io) => {
  const liveScoring = io.of('/live-scoring');

  liveScoring.on('connection', (socket) => {
    console.log(`Live scoring client connected: ${socket.id}`);

    socket.on('join-match', ({ matchId }) => {
      socket.join(`match:${matchId}`);
      console.log(`${socket.id} joined match:${matchId}`);
    });

    socket.on('leave-match', ({ matchId }) => {
      socket.leave(`match:${matchId}`);
      console.log(`${socket.id} left match:${matchId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Live scoring client disconnected: ${socket.id}`);
    });
  });
};
```

- [ ] **Step 4: Register routes and socket in app.js / server.js**

Add to `backend/src/app.js`:
```javascript
import liveScoreRoutes from './routes/livescores.js';
app.use('/api/livescores', liveScoreRoutes);
```

Update `backend/server.js` — add after `app.set('io', io)`:
```javascript
import { setupSocketIO } from './src/socket/index.js';

// After io is created:
setupSocketIO(io);
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add live scoring API with Socket.IO real-time updates"
```

---

## Phase 5: Auction System

### Task 13: Auction API & Socket.IO

**Files:**
- Create: `backend/src/controllers/auctionController.js`
- Create: `backend/src/routes/auctions.js`
- Create: `backend/src/socket/auction.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Create auction socket handler**

Create `backend/src/socket/auction.js`:
```javascript
export const setupAuction = (io) => {
  const auctionNs = io.of('/auction');

  auctionNs.on('connection', (socket) => {
    console.log(`Auction client connected: ${socket.id}`);

    socket.on('join-auction', ({ tournamentId }) => {
      socket.join(`auction:${tournamentId}`);
      console.log(`${socket.id} joined auction:${tournamentId}`);
    });

    socket.on('leave-auction', ({ tournamentId }) => {
      socket.leave(`auction:${tournamentId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Auction client disconnected: ${socket.id}`);
    });
  });
};
```

- [ ] **Step 2: Create auction controller**

Create `backend/src/controllers/auctionController.js`:
```javascript
import Auction from '../models/Auction.js';
import Bid from '../models/Bid.js';
import Player from '../models/Player.js';
import Team from '../models/Team.js';

export const getAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findOne({ tournamentId: req.params.tournamentId })
      .populate('currentPlayerId', 'name skill basePrice')
      .populate('currentBidderId', 'name');
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    res.json({ success: true, data: auction });
  } catch (error) {
    next(error);
  }
};

export const startAuction = async (req, res, next) => {
  try {
    const { tournamentId } = req.params;

    const existing = await Auction.findOne({ tournamentId });
    if (existing) return res.status(400).json({ success: false, message: 'Auction already exists for this tournament' });

    const players = await Player.find({ tournamentId, status: 'available' });
    const playerIds = players.map((p) => p._id);

    const auction = await Auction.create({
      tournamentId,
      status: 'live',
      remainingPlayers: playerIds,
      soldPlayers: [],
      unsoldPlayers: [],
    });

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${tournamentId}`).emit('auction-started', { tournamentId });

    res.status(201).json({ success: true, data: auction });
  } catch (error) {
    next(error);
  }
};

export const pauseAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findOneAndUpdate(
      { tournamentId: req.params.tournamentId },
      { status: 'paused' },
      { new: true }
    );
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${req.params.tournamentId}`).emit('auction-paused', {});

    res.json({ success: true, data: auction });
  } catch (error) {
    next(error);
  }
};

export const resumeAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findOneAndUpdate(
      { tournamentId: req.params.tournamentId },
      { status: 'live' },
      { new: true }
    );
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    res.json({ success: true, data: auction });
  } catch (error) {
    next(error);
  }
};

export const endAuction = async (req, res, next) => {
  try {
    const auction = await Auction.findOneAndUpdate(
      { tournamentId: req.params.tournamentId },
      { status: 'completed', currentPlayerId: null, currentBid: 0, currentBidderId: null },
      { new: true }
    );
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${req.params.tournamentId}`).emit('auction-ended', {
      summary: { sold: auction.soldPlayers.length, unsold: auction.unsoldPlayers.length },
    });

    res.json({ success: true, data: auction });
  } catch (error) {
    next(error);
  }
};

export const nextPlayer = async (req, res, next) => {
  try {
    const auction = await Auction.findOne({ tournamentId: req.params.tournamentId });
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });

    if (auction.remainingPlayers.length === 0) {
      return res.status(400).json({ success: false, message: 'No more players remaining' });
    }

    const nextPlayerId = auction.remainingPlayers[0];
    const player = await Player.findById(nextPlayerId);

    auction.currentPlayerId = nextPlayerId;
    auction.currentBid = player.basePrice;
    auction.currentBidderId = null;
    auction.timer = 30;
    auction.remainingPlayers.shift();
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${req.params.tournamentId}`).emit('new-player', {
      player: { _id: player._id, name: player.name, skill: player.skill, battingStyle: player.battingStyle, bowlingStyle: player.bowlingStyle },
      basePrice: player.basePrice,
    });

    res.json({ success: true, data: auction });
  } catch (error) {
    next(error);
  }
};

export const placeBid = async (req, res, next) => {
  try {
    const { teamId, amount } = req.body;
    const auction = await Auction.findOne({ tournamentId: req.params.tournamentId });
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    if (auction.status !== 'live') return res.status(400).json({ success: false, message: 'Auction is not live' });
    if (!auction.currentPlayerId) return res.status(400).json({ success: false, message: 'No player currently being auctioned' });

    if (amount <= auction.currentBid) {
      return res.status(400).json({ success: false, message: 'Bid must be higher than current bid' });
    }

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    if (team.remainingBudget < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient budget' });
    }

    auction.currentBid = amount;
    auction.currentBidderId = teamId;
    auction.timer = 15; // Reset timer on new bid
    await auction.save();

    await Bid.create({
      auctionId: auction._id,
      playerId: auction.currentPlayerId,
      teamId,
      amount,
    });

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${req.params.tournamentId}`).emit('new-bid', {
      teamId,
      teamName: team.name,
      amount,
    });

    res.json({ success: true, data: auction });
  } catch (error) {
    next(error);
  }
};

export const sellPlayer = async (req, res, next) => {
  try {
    const auction = await Auction.findOne({ tournamentId: req.params.tournamentId });
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    if (!auction.currentPlayerId || !auction.currentBidderId) {
      return res.status(400).json({ success: false, message: 'No active bid to sell' });
    }

    const player = await Player.findByIdAndUpdate(auction.currentPlayerId, {
      teamId: auction.currentBidderId,
      status: 'sold',
    }, { new: true });

    const team = await Team.findById(auction.currentBidderId);
    team.remainingBudget -= auction.currentBid;
    team.playerCount += 1;
    await team.save();

    auction.soldPlayers.push({
      playerId: auction.currentPlayerId,
      teamId: auction.currentBidderId,
      amount: auction.currentBid,
    });
    auction.currentPlayerId = null;
    auction.currentBid = 0;
    auction.currentBidderId = null;
    auction.timer = 0;
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${req.params.tournamentId}`).emit('player-sold', {
      player: { _id: player._id, name: player.name },
      team: { _id: team._id, name: team.name },
      amount: auction.soldPlayers[auction.soldPlayers.length - 1].amount,
    });

    res.json({ success: true, data: auction });
  } catch (error) {
    next(error);
  }
};

export const markUnsold = async (req, res, next) => {
  try {
    const auction = await Auction.findOne({ tournamentId: req.params.tournamentId });
    if (!auction) return res.status(404).json({ success: false, message: 'Auction not found' });
    if (!auction.currentPlayerId) return res.status(400).json({ success: false, message: 'No player to mark unsold' });

    const player = await Player.findByIdAndUpdate(auction.currentPlayerId, { status: 'unsold' }, { new: true });

    auction.unsoldPlayers.push(auction.currentPlayerId);
    auction.currentPlayerId = null;
    auction.currentBid = 0;
    auction.currentBidderId = null;
    auction.timer = 0;
    await auction.save();

    const io = req.app.get('io');
    io.of('/auction').to(`auction:${req.params.tournamentId}`).emit('player-unsold', {
      player: { _id: player._id, name: player.name },
    });

    res.json({ success: true, data: auction });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Create auction routes**

Create `backend/src/routes/auctions.js`:
```javascript
import { Router } from 'express';
import {
  getAuction, startAuction, pauseAuction, resumeAuction, endAuction,
  nextPlayer, placeBid, sellPlayer, markUnsold,
} from '../controllers/auctionController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/:tournamentId', authenticate, getAuction);
router.post('/:tournamentId/start', authenticate, authorize('super_admin'), startAuction);
router.post('/:tournamentId/pause', authenticate, authorize('super_admin'), pauseAuction);
router.post('/:tournamentId/resume', authenticate, authorize('super_admin'), resumeAuction);
router.post('/:tournamentId/end', authenticate, authorize('super_admin'), endAuction);
router.post('/:tournamentId/next-player', authenticate, authorize('super_admin'), nextPlayer);
router.post('/:tournamentId/bid', authenticate, authorize('team_owner'), placeBid);
router.post('/:tournamentId/sell', authenticate, authorize('super_admin'), sellPlayer);
router.post('/:tournamentId/unsold', authenticate, authorize('super_admin'), markUnsold);

export default router;
```

- [ ] **Step 4: Register route in app.js**

Add to `backend/src/app.js`:
```javascript
import auctionRoutes from './routes/auctions.js';
app.use('/api/auctions', auctionRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add auction system API with Socket.IO real-time bidding"
```

---

## Phase 6: Dashboard API & Seed Data

### Task 14: Dashboard & Registration APIs

**Files:**
- Create: `backend/src/controllers/dashboardController.js`
- Create: `backend/src/controllers/registrationController.js`
- Create: `backend/src/routes/dashboard.js`
- Create: `backend/src/routes/registrations.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Create dashboard controller**

Create `backend/src/controllers/dashboardController.js`:
```javascript
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';
import Player from '../models/Player.js';

export const getAdminStats = async (req, res, next) => {
  try {
    const [userCount, tournamentCount, teamCount, matchCount, playerCount, liveMatches, activeTournaments] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Tournament.countDocuments(),
      Team.countDocuments(),
      Match.countDocuments(),
      Player.countDocuments(),
      Match.countDocuments({ status: 'live' }),
      Tournament.countDocuments({ status: 'active' }),
    ]);

    res.json({
      success: true,
      data: {
        users: userCount,
        tournaments: tournamentCount,
        teams: teamCount,
        matches: matchCount,
        players: playerCount,
        liveMatches,
        activeTournaments,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getRecentActivity = async (req, res, next) => {
  try {
    const [recentMatches, recentTournaments, recentUsers] = await Promise.all([
      Match.find().sort({ updatedAt: -1 }).limit(5).populate('team1Id', 'name').populate('team2Id', 'name'),
      Tournament.find().sort({ createdAt: -1 }).limit(5),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt'),
    ]);

    res.json({
      success: true,
      data: { recentMatches, recentTournaments, recentUsers },
    });
  } catch (error) {
    next(error);
  }
};

export const getTeamDashboard = async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId).populate('ownerId', 'name');
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const players = await Player.find({ teamId: req.params.teamId });
    const matches = await Match.find({
      $or: [{ team1Id: req.params.teamId }, { team2Id: req.params.teamId }],
    }).populate('team1Id', 'name').populate('team2Id', 'name');

    const wins = matches.filter((m) => m.result?.winner?.toString() === req.params.teamId).length;

    res.json({
      success: true,
      data: {
        team,
        playerCount: players.length,
        matchCount: matches.length,
        wins,
        losses: matches.filter((m) => m.status === 'completed').length - wins,
        remainingBudget: team.remainingBudget,
      },
    });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 2: Create registration controller**

Create `backend/src/controllers/registrationController.js`:
```javascript
import Registration from '../models/Registration.js';

export const listRegistrations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tournamentId, status } = req.query;
    const filter = {};
    if (tournamentId) filter.tournamentId = tournamentId;
    if (status) filter.status = status;

    const total = await Registration.countDocuments(filter);
    const registrations = await Registration.find(filter)
      .populate('playerId', 'name email')
      .populate('tournamentId', 'name')
      .populate('reviewedBy', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ appliedAt: -1 });

    res.json({
      success: true,
      data: registrations,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const reviewRegistration = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }

    const registration = await Registration.findByIdAndUpdate(
      req.params.id,
      { status, reviewedBy: req.user.id, reviewedAt: new Date() },
      { new: true }
    ).populate('playerId', 'name email').populate('tournamentId', 'name');

    if (!registration) return res.status(404).json({ success: false, message: 'Registration not found' });

    res.json({ success: true, data: registration });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Create routes**

Create `backend/src/routes/dashboard.js`:
```javascript
import { Router } from 'express';
import { getAdminStats, getRecentActivity, getTeamDashboard } from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/admin/stats', authenticate, authorize('super_admin'), getAdminStats);
router.get('/admin/recent-activity', authenticate, authorize('super_admin'), getRecentActivity);
router.get('/team/:teamId', authenticate, authorize('team_owner', 'super_admin'), getTeamDashboard);

export default router;
```

Create `backend/src/routes/registrations.js`:
```javascript
import { Router } from 'express';
import { listRegistrations, reviewRegistration } from '../controllers/registrationController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, authorize('super_admin'), listRegistrations);
router.put('/:id', authenticate, authorize('super_admin'), reviewRegistration);

export default router;
```

- [ ] **Step 4: Register routes in app.js**

Add to `backend/src/app.js`:
```javascript
import dashboardRoutes from './routes/dashboard.js';
import registrationRoutes from './routes/registrations.js';
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/registrations', registrationRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add dashboard and registration management APIs"
```

---

### Task 15: Seed Script

**Files:**
- Create: `backend/src/utils/seed.js`

- [ ] **Step 1: Create seed script**

Create `backend/src/utils/seed.js`:
```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Player from '../models/Player.js';
import Match from '../models/Match.js';

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Tournament.deleteMany({}),
      Team.deleteMany({}),
      Player.deleteMany({}),
      Match.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create users
    const admin = await User.create({ name: 'Admin', email: 'admin@sportsleague.com', password: 'admin123', role: 'super_admin' });
    const owner1 = await User.create({ name: 'Rajesh Kumar', email: 'rajesh@test.com', password: 'test123', role: 'team_owner' });
    const owner2 = await User.create({ name: 'Priya Sharma', email: 'priya@test.com', password: 'test123', role: 'team_owner' });
    const scorer1 = await User.create({ name: 'Scorer One', email: 'scorer1@test.com', password: 'test123', role: 'scorer' });
    const scorer2 = await User.create({ name: 'Scorer Two', email: 'scorer2@test.com', password: 'test123', role: 'scorer' });

    const playerUsers = [];
    for (let i = 1; i <= 5; i++) {
      const pu = await User.create({ name: `Player ${i}`, email: `player${i}@test.com`, password: 'test123', role: 'player' });
      playerUsers.push(pu);
    }
    console.log('Created users');

    // Create tournament
    const tournament = await Tournament.create({
      name: 'Premier Cricket League 2026',
      format: 'T20',
      location: 'Mumbai',
      venue: 'Wankhede Stadium',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-30'),
      status: 'active',
      maxTeams: 8,
      description: 'The premier T20 cricket tournament',
      createdBy: admin._id,
    });
    console.log('Created tournament');

    // Create teams
    const team1 = await Team.create({ name: 'Mumbai Warriors', ownerId: owner1._id, tournamentId: tournament._id, budget: 1000000, remainingBudget: 800000, playerCount: 5 });
    const team2 = await Team.create({ name: 'Delhi Capitals', ownerId: owner2._id, tournamentId: tournament._id, budget: 1000000, remainingBudget: 750000, playerCount: 5 });
    const team3 = await Team.create({ name: 'Chennai Kings', tournamentId: tournament._id, budget: 1000000, remainingBudget: 900000, playerCount: 5 });
    const team4 = await Team.create({ name: 'Bangalore Royals', tournamentId: tournament._id, budget: 1000000, remainingBudget: 850000, playerCount: 5 });
    console.log('Created teams');

    // Create players
    const skills = ['batsman', 'bowler', 'allrounder', 'wicketkeeper'];
    const battingStyles = ['right-hand', 'left-hand'];
    const bowlingStyles = ['fast', 'medium', 'spin', 'none'];
    const teams = [team1, team2, team3, team4];

    for (let i = 0; i < 20; i++) {
      const teamIndex = Math.floor(i / 5);
      await Player.create({
        name: `Player ${String.fromCharCode(65 + i)}`,
        age: 20 + Math.floor(Math.random() * 15),
        skill: skills[i % 4],
        battingStyle: battingStyles[i % 2],
        bowlingStyle: bowlingStyles[i % 4],
        basePrice: 50000 + Math.floor(Math.random() * 200000),
        teamId: teams[teamIndex]._id,
        tournamentId: tournament._id,
        userId: i < 5 ? playerUsers[i]._id : undefined,
        status: 'sold',
        stats: {
          matches: Math.floor(Math.random() * 30),
          runs: Math.floor(Math.random() * 1500),
          wickets: Math.floor(Math.random() * 50),
          catches: Math.floor(Math.random() * 20),
          highestScore: Math.floor(Math.random() * 120),
          bestBowling: `${Math.floor(Math.random() * 5)}/${Math.floor(Math.random() * 40)}`,
          average: parseFloat((Math.random() * 50).toFixed(2)),
          strikeRate: parseFloat((100 + Math.random() * 80).toFixed(2)),
          economyRate: parseFloat((5 + Math.random() * 5).toFixed(2)),
        },
      });
    }
    console.log('Created 20 players');

    // Create matches
    await Match.create({ tournamentId: tournament._id, team1Id: team1._id, team2Id: team2._id, date: new Date('2026-05-01'), venue: 'Wankhede Stadium', status: 'completed', tossWinner: team1._id, tossDecision: 'bat', result: { winner: team1._id, winType: 'runs', winMargin: 25, summary: 'Mumbai Warriors won by 25 runs' }, scorerId: scorer1._id });
    await Match.create({ tournamentId: tournament._id, team1Id: team3._id, team2Id: team4._id, date: new Date('2026-05-03'), venue: 'Chepauk Stadium', status: 'completed', tossWinner: team4._id, tossDecision: 'bowl', result: { winner: team4._id, winType: 'wickets', winMargin: 5, summary: 'Bangalore Royals won by 5 wickets' }, scorerId: scorer2._id });
    await Match.create({ tournamentId: tournament._id, team1Id: team1._id, team2Id: team3._id, date: new Date('2026-05-10'), venue: 'Wankhede Stadium', status: 'upcoming', scorerId: scorer1._id });
    await Match.create({ tournamentId: tournament._id, team1Id: team2._id, team2Id: team4._id, date: new Date('2026-05-12'), venue: 'Feroz Shah Kotla', status: 'upcoming', scorerId: scorer2._id });
    console.log('Created matches');

    console.log('\n--- Seed complete ---');
    console.log('Admin: admin@sportsleague.com / admin123');
    console.log('Team Owner 1: rajesh@test.com / test123');
    console.log('Team Owner 2: priya@test.com / test123');
    console.log('Scorer: scorer1@test.com / test123');
    console.log('Player: player1@test.com / test123');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
```

- [ ] **Step 2: Run seed**

```bash
cd C:/laragon/www/sports-league/backend && npm run seed
```

Expected: All data created, credentials printed.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add database seed script with sample tournament data"
```

---

## Phase 7: Public Frontend

### Task 16: Initialize Public Frontend

**Files:**
- Create: `frontend/public-app/` (Vite React project)

- [ ] **Step 1: Scaffold Vite React app**

```bash
cd C:/laragon/www/sports-league
mkdir -p frontend
cd frontend
npm create vite@latest public-app -- --template react
cd public-app
npm install
npm install react-router-dom axios socket.io-client @tanstack/react-query react-hot-toast dayjs react-icons
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Vite**

Replace `frontend/public-app/vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 3: Configure Tailwind**

Replace `frontend/public-app/src/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold public frontend with Vite, React, Tailwind"
```

---

### Task 17: Frontend Services & Context

**Files:**
- Create: `frontend/public-app/src/services/api.js`
- Create: `frontend/public-app/src/services/socket.js`
- Create: `frontend/public-app/src/context/AuthContext.jsx`

- [ ] **Step 1: Create API client**

Create `frontend/public-app/src/services/api.js`:
```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        localStorage.setItem('accessToken', data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 2: Create Socket client**

Create `frontend/public-app/src/services/socket.js`:
```javascript
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const liveScoreSocket = io(`${SOCKET_URL}/live-scoring`, {
  autoConnect: false,
  transports: ['websocket'],
});

export const auctionSocket = io(`${SOCKET_URL}/auction`, {
  autoConnect: false,
  transports: ['websocket'],
});
```

- [ ] **Step 3: Create Auth context**

Create `frontend/public-app/src/context/AuthContext.jsx`:
```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => setUser(data.data))
        .catch(() => {
          localStorage.removeItem('accessToken');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  };

  const register = async (name, email, password, role) => {
    const { data } = await api.post('/auth/register', { name, email, password, role });
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('accessToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add API client, Socket.IO client, and AuthContext"
```

---

### Task 18: Public Frontend — Layout & Routing

**Files:**
- Create: `frontend/public-app/src/components/Layout.jsx`
- Create: `frontend/public-app/src/components/Navbar.jsx`
- Create: `frontend/public-app/src/components/ProtectedRoute.jsx`
- Modify: `frontend/public-app/src/App.jsx`
- Modify: `frontend/public-app/src/main.jsx`
- Create: all page stub files

- [ ] **Step 1: Create Navbar**

Create `frontend/public-app/src/components/Navbar.jsx`:
```jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMenu, FiX } from 'react-icons/fi';
import { useState } from 'react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold text-emerald-400">SportsLeague</Link>

          <div className="hidden md:flex items-center space-x-6">
            <Link to="/tournaments" className="hover:text-emerald-400 transition">Tournaments</Link>
            <Link to="/matches" className="hover:text-emerald-400 transition">Matches</Link>
            <Link to="/matches/live" className="hover:text-emerald-400 transition text-emerald-400 font-semibold">Live</Link>
            {user ? (
              <>
                <Link to="/profile" className="hover:text-emerald-400 transition">{user.name}</Link>
                <button onClick={logout} className="bg-red-600 px-3 py-1 rounded hover:bg-red-700 transition">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-emerald-400 transition">Login</Link>
                <Link to="/register" className="bg-emerald-600 px-4 py-1.5 rounded hover:bg-emerald-700 transition">Register</Link>
              </>
            )}
          </div>

          <button className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden px-4 pb-4 space-y-2">
          <Link to="/tournaments" className="block hover:text-emerald-400" onClick={() => setOpen(false)}>Tournaments</Link>
          <Link to="/matches" className="block hover:text-emerald-400" onClick={() => setOpen(false)}>Matches</Link>
          <Link to="/matches/live" className="block text-emerald-400 font-semibold" onClick={() => setOpen(false)}>Live</Link>
          {user ? (
            <>
              <Link to="/profile" className="block hover:text-emerald-400" onClick={() => setOpen(false)}>{user.name}</Link>
              <button onClick={() => { logout(); setOpen(false); }} className="block text-red-400">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="block hover:text-emerald-400" onClick={() => setOpen(false)}>Login</Link>
              <Link to="/register" className="block text-emerald-400" onClick={() => setOpen(false)}>Register</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
```

- [ ] **Step 2: Create Layout and ProtectedRoute**

Create `frontend/public-app/src/components/Layout.jsx`:
```jsx
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => (
  <div className="min-h-screen bg-gray-50">
    <Navbar />
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Outlet />
    </main>
  </div>
);

export default Layout;
```

Create `frontend/public-app/src/components/ProtectedRoute.jsx`:
```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

export default ProtectedRoute;
```

- [ ] **Step 3: Create page stubs**

Create each page file. These will be expanded in the next task — for now, simple placeholders to validate routing:

Create `frontend/public-app/src/pages/Home.jsx`:
```jsx
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../services/api';

const Home = () => {
  const [tournaments, setTournaments] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);

  useEffect(() => {
    api.get('/tournaments?status=active&limit=4').then(({ data }) => setTournaments(data.data));
    api.get('/matches/live').then(({ data }) => setLiveMatches(data.data));
  }, []);

  return (
    <div>
      <section className="text-center py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Sports League & Tournament Platform</h1>
        <p className="text-lg text-gray-600 mb-8">Manage cricket tournaments, live scoring, and player auctions</p>
        <Link to="/tournaments" className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition text-lg">View Tournaments</Link>
      </section>

      {liveMatches.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Live Matches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveMatches.map((match) => (
              <Link key={match._id} to={`/matches/${match._id}`} className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500 hover:shadow-md transition">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{match.team1Id?.name}</span>
                  <span className="text-sm text-gray-500">vs</span>
                  <span className="font-semibold">{match.team2Id?.name}</span>
                </div>
                <p className="text-sm text-red-500 mt-2 font-medium">LIVE</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-2xl font-bold mb-4">Active Tournaments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tournaments.map((t) => (
            <Link key={t._id} to={`/tournaments/${t._id}`} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
              <h3 className="font-semibold text-lg">{t.name}</h3>
              <p className="text-sm text-gray-500">{t.format} - {t.location}</p>
              <span className="inline-block mt-2 text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">{t.status}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
```

Create `frontend/public-app/src/pages/Login.jsx`:
```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Logged in successfully');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <h1 className="text-2xl font-bold text-center mb-6">Login</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
        <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 transition">Login</button>
        <p className="text-center text-sm text-gray-500">Don't have an account? <Link to="/register" className="text-emerald-600 hover:underline">Register</Link></p>
      </form>
    </div>
  );
};

export default Login;
```

Create `frontend/public-app/src/pages/Register.jsx`:
```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'player' });
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await register(form.name, form.email, form.password, form.role);
      toast.success('Registration successful');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="max-w-md mx-auto mt-16">
      <h1 className="text-2xl font-bold text-center mb-6">Register</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input type="text" value={form.name} onChange={update('name')} required className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={form.email} onChange={update('email')} required className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input type="password" value={form.password} onChange={update('password')} required minLength={6} className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select value={form.role} onChange={update('role')} className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
            <option value="player">Player</option>
            <option value="team_owner">Team Owner</option>
          </select>
        </div>
        <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 transition">Register</button>
        <p className="text-center text-sm text-gray-500">Already have an account? <Link to="/login" className="text-emerald-600 hover:underline">Login</Link></p>
      </form>
    </div>
  );
};

export default Register;
```

Create stub pages for `Tournaments.jsx`, `TournamentDetail.jsx`, `Matches.jsx`, `MatchDetail.jsx`, `LiveMatches.jsx`, `TeamProfile.jsx`, `PlayerProfile.jsx`, `AuctionViewer.jsx`, `Profile.jsx`:

Create `frontend/public-app/src/pages/Tournaments.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const Tournaments = () => {
  const [tournaments, setTournaments] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const params = status ? `?status=${status}` : '';
    api.get(`/tournaments${params}`).then(({ data }) => setTournaments(data.data));
  }, [status]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-1.5">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="registration">Registration Open</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map((t) => (
          <Link key={t._id} to={`/tournaments/${t._id}`} className="bg-white p-5 rounded-lg shadow hover:shadow-md transition">
            <h2 className="text-lg font-semibold">{t.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.format} | {t.location}</p>
            <p className="text-sm text-gray-400 mt-1">{t.startDate ? new Date(t.startDate).toLocaleDateString() : 'TBD'}</p>
            <span className={`inline-block mt-2 text-xs px-2 py-1 rounded ${t.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{t.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Tournaments;
```

Create `frontend/public-app/src/pages/TournamentDetail.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const TournamentDetail = () => {
  const { id } = useParams();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.get(`/tournaments/${id}`).then(({ data }) => setTournament(data.data));
    api.get(`/tournaments/${id}/teams`).then(({ data }) => setTeams(data.data));
    api.get(`/tournaments/${id}/matches`).then(({ data }) => setMatches(data.data));
    api.get(`/tournaments/${id}/standings`).then(({ data }) => setStandings(data.data));
  }, [id]);

  if (!tournament) return <div className="text-center py-20">Loading...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{tournament.name}</h1>
      <p className="text-gray-500 mb-6">{tournament.format} | {tournament.location} | {tournament.venue}</p>

      <div className="flex space-x-4 mb-6 border-b">
        {['overview', 'standings', 'matches', 'teams'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 px-1 capitalize ${tab === t ? 'border-b-2 border-emerald-600 text-emerald-600 font-semibold' : 'text-gray-500'}`}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <p><strong>Status:</strong> {tournament.status}</p>
          <p><strong>Start:</strong> {tournament.startDate ? new Date(tournament.startDate).toLocaleDateString() : 'TBD'}</p>
          <p><strong>End:</strong> {tournament.endDate ? new Date(tournament.endDate).toLocaleDateString() : 'TBD'}</p>
          <p><strong>Max Teams:</strong> {tournament.maxTeams}</p>
          {tournament.description && <p className="mt-4 text-gray-600">{tournament.description}</p>}
        </div>
      )}

      {tab === 'standings' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Team</th><th className="px-4 py-3">P</th><th className="px-4 py-3">W</th><th className="px-4 py-3">L</th><th className="px-4 py-3">Pts</th></tr></thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.team._id} className="border-t"><td className="px-4 py-3">{i + 1}</td><td className="px-4 py-3 font-medium">{s.team.name}</td><td className="px-4 py-3 text-center">{s.played}</td><td className="px-4 py-3 text-center">{s.wins}</td><td className="px-4 py-3 text-center">{s.losses}</td><td className="px-4 py-3 text-center font-bold">{s.points}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'matches' && (
        <div className="space-y-3">
          {matches.map((m) => (
            <Link key={m._id} to={`/matches/${m._id}`} className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition">
              <div className="flex justify-between items-center">
                <span className="font-medium">{m.team1Id?.name} vs {m.team2Id?.name}</span>
                <span className={`text-xs px-2 py-1 rounded ${m.status === 'live' ? 'bg-red-100 text-red-700' : m.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{m.status}</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">{new Date(m.date).toLocaleDateString()} | {m.venue}</p>
              {m.result?.summary && <p className="text-sm text-emerald-600 mt-1">{m.result.summary}</p>}
            </Link>
          ))}
        </div>
      )}

      {tab === 'teams' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((t) => (
            <Link key={t._id} to={`/teams/${t._id}`} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
              <h3 className="font-semibold text-lg">{t.name}</h3>
              <p className="text-sm text-gray-500">Owner: {t.ownerId?.name || 'Unassigned'}</p>
              <p className="text-sm text-gray-500">Players: {t.playerCount}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentDetail;
```

Create `frontend/public-app/src/pages/Matches.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const Matches = () => {
  const [matches, setMatches] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const params = status ? `?status=${status}` : '';
    api.get(`/matches${params}`).then(({ data }) => setMatches(data.data));
  }, [status]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Matches</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-1.5">
          <option value="">All</option>
          <option value="live">Live</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="space-y-3">
        {matches.map((m) => (
          <Link key={m._id} to={`/matches/${m._id}`} className="block bg-white p-4 rounded-lg shadow hover:shadow-md transition">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-semibold">{m.team1Id?.name}</span>
                <span className="text-gray-400 mx-2">vs</span>
                <span className="font-semibold">{m.team2Id?.name}</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${m.status === 'live' ? 'bg-red-100 text-red-700 font-bold' : m.status === 'completed' ? 'bg-gray-100' : 'bg-blue-100 text-blue-700'}`}>{m.status.toUpperCase()}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{m.tournamentId?.name} | {new Date(m.date).toLocaleDateString()}</p>
            {m.result?.summary && <p className="text-sm text-emerald-600 mt-1">{m.result.summary}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Matches;
```

Create `frontend/public-app/src/pages/MatchDetail.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { liveScoreSocket } from '../services/socket';

const MatchDetail = () => {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [liveScore, setLiveScore] = useState(null);

  useEffect(() => {
    api.get(`/matches/${id}`).then(({ data }) => setMatch(data.data));
    api.get(`/livescores/${id}`).then(({ data }) => setLiveScore(data.data)).catch(() => {});

    liveScoreSocket.connect();
    liveScoreSocket.emit('join-match', { matchId: id });

    liveScoreSocket.on('ball-update', (data) => {
      api.get(`/livescores/${id}`).then(({ data }) => setLiveScore(data.data));
    });
    liveScoreSocket.on('wicket', () => {
      api.get(`/livescores/${id}`).then(({ data }) => setLiveScore(data.data));
    });
    liveScoreSocket.on('innings-end', () => {
      api.get(`/livescores/${id}`).then(({ data }) => setLiveScore(data.data));
    });
    liveScoreSocket.on('match-end', () => {
      api.get(`/matches/${id}`).then(({ data }) => setMatch(data.data));
      api.get(`/livescores/${id}`).then(({ data }) => setLiveScore(data.data));
    });

    return () => {
      liveScoreSocket.emit('leave-match', { matchId: id });
      liveScoreSocket.off('ball-update');
      liveScoreSocket.off('wicket');
      liveScoreSocket.off('innings-end');
      liveScoreSocket.off('match-end');
      liveScoreSocket.disconnect();
    };
  }, [id]);

  if (!match) return <div className="text-center py-20">Loading...</div>;

  const currentInnings = liveScore?.innings?.[liveScore.currentInnings - 1];

  return (
    <div>
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{match.team1Id?.name} vs {match.team2Id?.name}</h1>
          <span className={`px-3 py-1 rounded text-sm font-semibold ${match.status === 'live' ? 'bg-red-100 text-red-700' : match.status === 'completed' ? 'bg-gray-100' : 'bg-blue-100 text-blue-700'}`}>{match.status.toUpperCase()}</span>
        </div>
        <p className="text-gray-500">{match.tournamentId?.name} | {match.venue} | {new Date(match.date).toLocaleDateString()}</p>
        {match.result?.summary && <p className="text-lg font-semibold text-emerald-600 mt-4">{match.result.summary}</p>}
      </div>

      {liveScore && liveScore.innings.map((inn, i) => (
        <div key={i} className="bg-white p-6 rounded-lg shadow mb-4">
          <h2 className="text-lg font-bold mb-3">Innings {inn.inningsNumber} — {inn.totalRuns}/{inn.totalWickets} ({inn.totalOvers} ov)</h2>

          <h3 className="font-semibold text-sm text-gray-500 mb-2">Batting</h3>
          <table className="w-full text-sm mb-4">
            <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Batsman</th><th className="px-3 py-2">R</th><th className="px-3 py-2">B</th><th className="px-3 py-2">4s</th><th className="px-3 py-2">6s</th><th className="px-3 py-2">SR</th></tr></thead>
            <tbody>
              {inn.batsmen.map((b, j) => (
                <tr key={j} className="border-t"><td className="px-3 py-2">{b.playerId?.name || b.playerId} {b.isOut ? `(${b.dismissalType})` : ''}</td><td className="px-3 py-2 text-center font-medium">{b.runs}</td><td className="px-3 py-2 text-center">{b.balls}</td><td className="px-3 py-2 text-center">{b.fours}</td><td className="px-3 py-2 text-center">{b.sixes}</td><td className="px-3 py-2 text-center">{b.strikeRate}</td></tr>
              ))}
            </tbody>
          </table>

          <h3 className="font-semibold text-sm text-gray-500 mb-2">Bowling</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Bowler</th><th className="px-3 py-2">O</th><th className="px-3 py-2">M</th><th className="px-3 py-2">R</th><th className="px-3 py-2">W</th><th className="px-3 py-2">Econ</th></tr></thead>
            <tbody>
              {inn.bowlers.map((b, j) => (
                <tr key={j} className="border-t"><td className="px-3 py-2">{b.playerId?.name || b.playerId}</td><td className="px-3 py-2 text-center">{b.overs}</td><td className="px-3 py-2 text-center">{b.maidens}</td><td className="px-3 py-2 text-center">{b.runs}</td><td className="px-3 py-2 text-center font-medium">{b.wickets}</td><td className="px-3 py-2 text-center">{b.economyRate}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default MatchDetail;
```

Create `frontend/public-app/src/pages/LiveMatches.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const LiveMatches = () => {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    api.get('/matches/live').then(({ data }) => setMatches(data.data));
    const interval = setInterval(() => {
      api.get('/matches/live').then(({ data }) => setMatches(data.data));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-red-600">Live Matches</h1>
      {matches.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No live matches at the moment</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((m) => (
            <Link key={m._id} to={`/matches/${m._id}`} className="bg-white p-5 rounded-lg shadow border-l-4 border-red-500 hover:shadow-md transition">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">{m.team1Id?.name}</span>
                <span className="text-gray-400">vs</span>
                <span className="font-semibold text-lg">{m.team2Id?.name}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">{m.tournamentId?.name} | {m.venue}</p>
              <span className="inline-block mt-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold animate-pulse">LIVE</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveMatches;
```

Create `frontend/public-app/src/pages/TeamProfile.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const TeamProfile = () => {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    api.get(`/teams/${id}`).then(({ data }) => setTeam(data.data));
    api.get(`/teams/${id}/players`).then(({ data }) => setPlayers(data.data));
  }, [id]);

  if (!team) return <div className="text-center py-20">Loading...</div>;

  return (
    <div>
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h1 className="text-3xl font-bold">{team.name}</h1>
        <p className="text-gray-500">Owner: {team.ownerId?.name || 'Unassigned'} | Tournament: {team.tournamentId?.name}</p>
        <div className="flex space-x-6 mt-4 text-sm">
          <span>Budget: <strong>{team.budget?.toLocaleString()}</strong></span>
          <span>Remaining: <strong>{team.remainingBudget?.toLocaleString()}</strong></span>
          <span>Players: <strong>{team.playerCount}</strong></span>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Squad</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map((p) => (
          <Link key={p._id} to={`/players/${p._id}`} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition">
            <h3 className="font-semibold">{p.name}</h3>
            <p className="text-sm text-gray-500 capitalize">{p.skill} | {p.battingStyle}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default TeamProfile;
```

Create `frontend/public-app/src/pages/PlayerProfile.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const PlayerProfile = () => {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    api.get(`/players/${id}`).then(({ data }) => setPlayer(data.data));
  }, [id]);

  if (!player) return <div className="text-center py-20">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-3xl font-bold">{player.name}</h1>
        <p className="text-gray-500 capitalize">{player.skill} | {player.battingStyle} bat | {player.bowlingStyle} bowl</p>
        <p className="text-sm text-gray-400 mt-1">Age: {player.age} | Team: {player.teamId?.name || 'Unassigned'}</p>

        <h2 className="text-lg font-semibold mt-6 mb-3">Statistics</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            ['Matches', player.stats?.matches],
            ['Runs', player.stats?.runs],
            ['Wickets', player.stats?.wickets],
            ['Highest', player.stats?.highestScore],
            ['Average', player.stats?.average],
            ['SR', player.stats?.strikeRate],
            ['Econ', player.stats?.economyRate],
            ['Catches', player.stats?.catches],
            ['Best Bowl', player.stats?.bestBowling],
          ].map(([label, val]) => (
            <div key={label} className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold">{val ?? '-'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;
```

Create `frontend/public-app/src/pages/AuctionViewer.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { auctionSocket } from '../services/socket';

const AuctionViewer = () => {
  const { tournamentId } = useParams();
  const [auction, setAuction] = useState(null);

  const fetchAuction = () => {
    api.get(`/auctions/${tournamentId}`).then(({ data }) => setAuction(data.data)).catch(() => {});
  };

  useEffect(() => {
    fetchAuction();
    auctionSocket.connect();
    auctionSocket.emit('join-auction', { tournamentId });

    auctionSocket.on('new-player', fetchAuction);
    auctionSocket.on('new-bid', fetchAuction);
    auctionSocket.on('player-sold', fetchAuction);
    auctionSocket.on('player-unsold', fetchAuction);
    auctionSocket.on('auction-ended', fetchAuction);

    return () => {
      auctionSocket.emit('leave-auction', { tournamentId });
      auctionSocket.off('new-player');
      auctionSocket.off('new-bid');
      auctionSocket.off('player-sold');
      auctionSocket.off('player-unsold');
      auctionSocket.off('auction-ended');
      auctionSocket.disconnect();
    };
  }, [tournamentId]);

  if (!auction) return <div className="text-center py-20">No active auction</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Player Auction</h1>
      <span className={`inline-block mb-6 px-3 py-1 rounded text-sm font-semibold ${auction.status === 'live' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{auction.status.toUpperCase()}</span>

      {auction.currentPlayerId && (
        <div className="bg-white p-6 rounded-lg shadow mb-6 border-l-4 border-yellow-500">
          <h2 className="text-xl font-bold">Current Player: {auction.currentPlayerId.name || 'Loading...'}</h2>
          <p className="text-2xl font-bold text-emerald-600 mt-2">Current Bid: {auction.currentBid?.toLocaleString()}</p>
          {auction.currentBidderId && <p className="text-sm text-gray-500 mt-1">Highest Bidder: {auction.currentBidderId.name || auction.currentBidderId}</p>}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Sold Players ({auction.soldPlayers.length})</h2>
      <div className="space-y-2 mb-6">
        {auction.soldPlayers.map((sp, i) => (
          <div key={i} className="bg-white p-3 rounded shadow-sm flex justify-between">
            <span>{sp.playerId?.name || sp.playerId}</span>
            <span className="font-bold text-emerald-600">{sp.amount?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuctionViewer;
```

Create `frontend/public-app/src/pages/Profile.jsx`:
```jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${user._id}`, { name, phone });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={user?.email} disabled className="w-full border rounded px-3 py-2 bg-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <input value={user?.role} disabled className="w-full border rounded px-3 py-2 bg-gray-100 capitalize" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
        <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 transition">Update Profile</button>
      </form>
    </div>
  );
};

export default Profile;
```

- [ ] **Step 4: Wire up App.jsx and main.jsx**

Replace `frontend/public-app/src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import LiveMatches from './pages/LiveMatches';
import TeamProfile from './pages/TeamProfile';
import PlayerProfile from './pages/PlayerProfile';
import AuctionViewer from './pages/AuctionViewer';
import Profile from './pages/Profile';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/matches/live" element={<LiveMatches />} />
            <Route path="/matches/:id" element={<MatchDetail />} />
            <Route path="/teams/:id" element={<TeamProfile />} />
            <Route path="/players/:id" element={<PlayerProfile />} />
            <Route path="/auctions/:tournamentId" element={<AuctionViewer />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
```

Replace `frontend/public-app/src/main.jsx`:
```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Test public frontend starts**

```bash
cd C:/laragon/www/sports-league/frontend/public-app && npm run dev
```

Expected: Vite dev server on port 3000, loads home page.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add public frontend with all pages, routing, auth, and live score views"
```

---

## Phase 8: Admin Dashboard

### Task 19: Initialize Admin Dashboard

**Files:**
- Create: `frontend/admin-app/` (Vite React project)

- [ ] **Step 1: Scaffold admin Vite React app**

```bash
cd C:/laragon/www/sports-league/frontend
npm create vite@latest admin-app -- --template react
cd admin-app
npm install
npm install react-router-dom axios socket.io-client @tanstack/react-query react-hot-toast dayjs react-icons recharts
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Configure Vite for port 3001**

Replace `frontend/admin-app/vite.config.js`:
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 3: Configure Tailwind**

Replace `frontend/admin-app/src/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Copy shared services**

Copy `api.js` and `socket.js` from public-app:

Create `frontend/admin-app/src/services/api.js` (identical to public-app's `api.js` from Task 17 Step 1).

Create `frontend/admin-app/src/services/socket.js` (identical to public-app's `socket.js` from Task 17 Step 2).

Create `frontend/admin-app/src/context/AuthContext.jsx` (identical to public-app's `AuthContext.jsx` from Task 17 Step 3).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold admin dashboard with Vite, React, Tailwind"
```

---

### Task 20: Admin Dashboard — Layout, Sidebar & Pages

**Files:**
- Create: `frontend/admin-app/src/components/AdminLayout.jsx`
- Create: `frontend/admin-app/src/components/Sidebar.jsx`
- Create: `frontend/admin-app/src/components/AdminProtectedRoute.jsx`
- Create: all admin page files
- Modify: `frontend/admin-app/src/App.jsx`
- Modify: `frontend/admin-app/src/main.jsx`

- [ ] **Step 1: Create Sidebar**

Create `frontend/admin-app/src/components/Sidebar.jsx`:
```jsx
import { NavLink } from 'react-router-dom';
import { FiHome, FiAward, FiUsers, FiUserCheck, FiCalendar, FiActivity, FiDollarSign, FiFileText } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', icon: FiHome, label: 'Dashboard', roles: ['super_admin', 'scorer'] },
  { to: '/tournaments', icon: FiAward, label: 'Tournaments', roles: ['super_admin'] },
  { to: '/teams', icon: FiUsers, label: 'Teams', roles: ['super_admin'] },
  { to: '/players', icon: FiUserCheck, label: 'Players', roles: ['super_admin'] },
  { to: '/users', icon: FiUsers, label: 'Users', roles: ['super_admin'] },
  { to: '/registrations', icon: FiFileText, label: 'Registrations', roles: ['super_admin'] },
];

const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-emerald-400">Admin Panel</h1>
        <p className="text-xs text-gray-400 mt-1">{user?.name} ({user?.role})</p>
      </div>

      <nav className="flex-1 py-4">
        {links.filter((l) => l.roles.includes(user?.role)).map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => `flex items-center px-4 py-2.5 text-sm transition ${isActive ? 'bg-gray-800 text-emerald-400 border-r-2 border-emerald-400' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            <link.icon className="mr-3" size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <button onClick={logout} className="w-full text-sm text-red-400 hover:text-red-300 transition">Logout</button>
      </div>
    </aside>
  );
};

export default Sidebar;
```

- [ ] **Step 2: Create AdminLayout and AdminProtectedRoute**

Create `frontend/admin-app/src/components/AdminLayout.jsx`:
```jsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const AdminLayout = () => (
  <div className="flex min-h-screen">
    <Sidebar />
    <main className="flex-1 bg-gray-100 p-6 overflow-auto">
      <Outlet />
    </main>
  </div>
);

export default AdminLayout;
```

Create `frontend/admin-app/src/components/AdminProtectedRoute.jsx`:
```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user || !['super_admin', 'scorer'].includes(user.role)) {
    return <Navigate to="/login" />;
  }
  return children;
};

export default AdminProtectedRoute;
```

- [ ] **Step 3: Create admin pages**

Create `frontend/admin-app/src/pages/Dashboard.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { FiUsers, FiAward, FiActivity, FiCalendar } from 'react-icons/fi';

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white p-5 rounded-lg shadow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <Icon className={`text-${color}-500`} size={28} />
    </div>
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    api.get('/dashboard/admin/stats').then(({ data }) => setStats(data.data));
    api.get('/dashboard/admin/recent-activity').then(({ data }) => setActivity(data.data));
  }, []);

  if (!stats) return <div className="text-center py-20">Loading...</div>;

  const chartData = [
    { name: 'Users', count: stats.users },
    { name: 'Tournaments', count: stats.tournaments },
    { name: 'Teams', count: stats.teams },
    { name: 'Matches', count: stats.matches },
    { name: 'Players', count: stats.players },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FiUsers} label="Total Users" value={stats.users} color="blue" />
        <StatCard icon={FiAward} label="Tournaments" value={stats.tournaments} color="emerald" />
        <StatCard icon={FiActivity} label="Live Matches" value={stats.liveMatches} color="red" />
        <StatCard icon={FiCalendar} label="Total Matches" value={stats.matches} color="purple" />
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-lg font-semibold mb-4">Overview</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {activity && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">Recent Matches</h2>
            {activity.recentMatches.map((m) => (
              <div key={m._id} className="border-b py-2 last:border-0 text-sm">
                {m.team1Id?.name} vs {m.team2Id?.name} — <span className="capitalize text-gray-500">{m.status}</span>
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">Recent Users</h2>
            {activity.recentUsers.map((u) => (
              <div key={u._id} className="border-b py-2 last:border-0 text-sm">
                {u.name} — <span className="capitalize text-gray-500">{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
```

Create `frontend/admin-app/src/pages/Login.jsx`:
```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      if (!['super_admin', 'scorer'].includes(user.role)) {
        toast.error('Admin access only');
        return;
      }
      toast.success('Welcome to Admin Panel');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-center text-gray-900">Admin Login</h1>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
        </div>
        <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 transition">Login</button>
      </form>
    </div>
  );
};

export default Login;
```

Create `frontend/admin-app/src/pages/TournamentManagement.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const TournamentManagement = () => {
  const [tournaments, setTournaments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', format: 'T20', location: '', venue: '', maxTeams: 8, description: '' });

  const fetch = () => api.get('/tournaments').then(({ data }) => setTournaments(data.data));
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tournaments', form);
      toast.success('Tournament created');
      setShowForm(false);
      setForm({ name: '', format: 'T20', location: '', venue: '', maxTeams: 8, description: '' });
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this tournament?')) return;
    try { await api.delete(`/tournaments/${id}`); toast.success('Deleted'); fetch(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700">{showForm ? 'Cancel' : '+ New Tournament'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Name" value={form.name} onChange={update('name')} required className="border rounded px-3 py-2" />
          <select value={form.format} onChange={update('format')} className="border rounded px-3 py-2"><option>T20</option><option>ODI</option><option>Test</option></select>
          <input placeholder="Location" value={form.location} onChange={update('location')} className="border rounded px-3 py-2" />
          <input placeholder="Venue" value={form.venue} onChange={update('venue')} className="border rounded px-3 py-2" />
          <input type="number" placeholder="Max Teams" value={form.maxTeams} onChange={update('maxTeams')} className="border rounded px-3 py-2" />
          <textarea placeholder="Description" value={form.description} onChange={update('description')} className="border rounded px-3 py-2 md:col-span-2" />
          <button type="submit" className="bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 md:col-span-2">Create</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3">Format</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Actions</th></tr></thead>
          <tbody>
            {tournaments.map((t) => (
              <tr key={t._id} className="border-t">
                <td className="px-4 py-3 font-medium"><Link to={`/tournaments/${t._id}`} className="text-emerald-600 hover:underline">{t.name}</Link></td>
                <td className="px-4 py-3 text-center">{t.format}</td>
                <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-1 rounded ${t.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100'}`}>{t.status}</span></td>
                <td className="px-4 py-3 text-center">{t.location}</td>
                <td className="px-4 py-3 text-center">{t.status === 'draft' && <button onClick={() => handleDelete(t._id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TournamentManagement;
```

Create `frontend/admin-app/src/pages/TeamManagement.jsx`:
```jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const TeamManagement = () => {
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', tournamentId: '', budget: 1000000 });

  const fetch = () => api.get('/teams').then(({ data }) => setTeams(data.data));
  useEffect(() => { fetch(); api.get('/tournaments').then(({ data }) => setTournaments(data.data)); }, []);

  const handleCreate = async (e) => { e.preventDefault(); try { await api.post('/teams', form); toast.success('Team created'); setShowForm(false); fetch(); } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } };
  const handleDelete = async (id) => { if (!confirm('Delete?')) return; try { await api.delete(`/teams/${id}`); toast.success('Deleted'); fetch(); } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } };
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Teams</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700">{showForm ? 'Cancel' : '+ New Team'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input placeholder="Team Name" value={form.name} onChange={update('name')} required className="border rounded px-3 py-2" />
          <select value={form.tournamentId} onChange={update('tournamentId')} required className="border rounded px-3 py-2"><option value="">Select Tournament</option>{tournaments.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>
          <input type="number" placeholder="Budget" value={form.budget} onChange={update('budget')} className="border rounded px-3 py-2" />
          <button type="submit" className="bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 md:col-span-3">Create Team</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3">Tournament</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Budget</th><th className="px-4 py-3">Players</th><th className="px-4 py-3">Actions</th></tr></thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t._id} className="border-t"><td className="px-4 py-3 font-medium">{t.name}</td><td className="px-4 py-3 text-center">{t.tournamentId?.name}</td><td className="px-4 py-3 text-center">{t.ownerId?.name || '-'}</td><td className="px-4 py-3 text-center">{t.remainingBudget?.toLocaleString()}/{t.budget?.toLocaleString()}</td><td className="px-4 py-3 text-center">{t.playerCount}</td><td className="px-4 py-3 text-center"><button onClick={() => handleDelete(t._id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TeamManagement;
```

Create `frontend/admin-app/src/pages/PlayerManagement.jsx`:
```jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const PlayerManagement = () => {
  const [players, setPlayers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', skill: 'batsman', age: '', battingStyle: 'right-hand', bowlingStyle: 'none', basePrice: 50000 });

  const fetch = () => api.get('/players').then(({ data }) => setPlayers(data.data));
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e) => { e.preventDefault(); try { await api.post('/players', form); toast.success('Player created'); setShowForm(false); fetch(); } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } };
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Players</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700">{showForm ? 'Cancel' : '+ New Player'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input placeholder="Name" value={form.name} onChange={update('name')} required className="border rounded px-3 py-2" />
          <select value={form.skill} onChange={update('skill')} className="border rounded px-3 py-2"><option value="batsman">Batsman</option><option value="bowler">Bowler</option><option value="allrounder">Allrounder</option><option value="wicketkeeper">Wicketkeeper</option></select>
          <input type="number" placeholder="Age" value={form.age} onChange={update('age')} className="border rounded px-3 py-2" />
          <select value={form.battingStyle} onChange={update('battingStyle')} className="border rounded px-3 py-2"><option value="right-hand">Right Hand</option><option value="left-hand">Left Hand</option></select>
          <select value={form.bowlingStyle} onChange={update('bowlingStyle')} className="border rounded px-3 py-2"><option value="none">None</option><option value="fast">Fast</option><option value="medium">Medium</option><option value="spin">Spin</option></select>
          <input type="number" placeholder="Base Price" value={form.basePrice} onChange={update('basePrice')} className="border rounded px-3 py-2" />
          <button type="submit" className="bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 md:col-span-3">Create Player</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3">Skill</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Base Price</th></tr></thead>
          <tbody>
            {players.map((p) => (
              <tr key={p._id} className="border-t"><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3 text-center capitalize">{p.skill}</td><td className="px-4 py-3 text-center">{p.teamId?.name || '-'}</td><td className="px-4 py-3 text-center capitalize">{p.status}</td><td className="px-4 py-3 text-center">{p.basePrice?.toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlayerManagement;
```

Create `frontend/admin-app/src/pages/UserManagement.jsx`:
```jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const fetch = () => api.get('/users').then(({ data }) => setUsers(data.data));
  useEffect(() => { fetch(); }, []);

  const handleCreateScorer = async (e) => { e.preventDefault(); try { await api.post('/users/create-scorer', form); toast.success('Scorer created'); setShowForm(false); fetch(); } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } };
  const handleDeactivate = async (id) => { if (!confirm('Deactivate?')) return; try { await api.delete(`/users/${id}`); toast.success('Deactivated'); fetch(); } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } };
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700">{showForm ? 'Cancel' : '+ New Scorer'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateScorer} className="bg-white p-6 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input placeholder="Name" value={form.name} onChange={update('name')} required className="border rounded px-3 py-2" />
          <input placeholder="Email" value={form.email} onChange={update('email')} required className="border rounded px-3 py-2" />
          <input type="password" placeholder="Password" value={form.password} onChange={update('password')} required minLength={6} className="border rounded px-3 py-2" />
          <button type="submit" className="bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 md:col-span-3">Create Scorer</button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t"><td className="px-4 py-3 font-medium">{u.name}</td><td className="px-4 py-3 text-center">{u.email}</td><td className="px-4 py-3 text-center capitalize">{u.role}</td><td className="px-4 py-3 text-center">{u.isActive ? <span className="text-green-600">Active</span> : <span className="text-red-500">Inactive</span>}</td><td className="px-4 py-3 text-center">{u.isActive && <button onClick={() => handleDeactivate(u._id)} className="text-red-500 hover:text-red-700 text-xs">Deactivate</button>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
```

Create `frontend/admin-app/src/pages/RegistrationManagement.jsx`:
```jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const RegistrationManagement = () => {
  const [registrations, setRegistrations] = useState([]);

  const fetch = () => api.get('/registrations').then(({ data }) => setRegistrations(data.data));
  useEffect(() => { fetch(); }, []);

  const handleReview = async (id, status) => {
    try { await api.put(`/registrations/${id}`, { status }); toast.success(`Registration ${status}`); fetch(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Player Registrations</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left">Player</th><th className="px-4 py-3">Tournament</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Applied</th><th className="px-4 py-3">Actions</th></tr></thead>
          <tbody>
            {registrations.map((r) => (
              <tr key={r._id} className="border-t"><td className="px-4 py-3 font-medium">{r.playerId?.name}</td><td className="px-4 py-3 text-center">{r.tournamentId?.name}</td><td className="px-4 py-3 text-center capitalize"><span className={`text-xs px-2 py-1 rounded ${r.status === 'approved' ? 'bg-green-100 text-green-800' : r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{r.status}</span></td><td className="px-4 py-3 text-center">{new Date(r.appliedAt).toLocaleDateString()}</td><td className="px-4 py-3 text-center space-x-2">{r.status === 'pending' && (<><button onClick={() => handleReview(r._id, 'approved')} className="text-green-600 hover:text-green-800 text-xs font-semibold">Approve</button><button onClick={() => handleReview(r._id, 'rejected')} className="text-red-500 hover:text-red-700 text-xs font-semibold">Reject</button></>)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegistrationManagement;
```

Create `frontend/admin-app/src/pages/LiveScoringPanel.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const LiveScoringPanel = () => {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [liveScore, setLiveScore] = useState(null);
  const [ballForm, setBallForm] = useState({ batsmanId: '', bowlerId: '', runs: 0, extras: { type: 'none', runs: 0 }, isWicket: false, wicket: { type: 'bowled' }, commentary: '' });

  const fetchData = () => {
    api.get(`/matches/${matchId}`).then(({ data }) => setMatch(data.data));
    api.get(`/livescores/${matchId}`).then(({ data }) => setLiveScore(data.data)).catch(() => {});
  };

  useEffect(() => { fetchData(); }, [matchId]);

  const startScoring = async () => {
    try {
      await api.post(`/livescores/${matchId}/start`, {
        battingTeamId: match.team1Id._id,
        bowlingTeamId: match.team2Id._id,
      });
      toast.success('Scoring started');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const recordBall = async () => {
    try {
      await api.post(`/livescores/${matchId}/ball`, ballForm);
      toast.success('Ball recorded');
      setBallForm({ ...ballForm, runs: 0, extras: { type: 'none', runs: 0 }, isWicket: false, commentary: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const undoBall = async () => {
    try { await api.post(`/livescores/${matchId}/undo`); toast.success('Ball undone'); fetchData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (!match) return <div className="text-center py-20">Loading...</div>;

  const currentInnings = liveScore?.innings?.[liveScore?.currentInnings - 1];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Live Scoring: {match.team1Id?.name} vs {match.team2Id?.name}</h1>

      {!liveScore && match.status === 'upcoming' && (
        <button onClick={startScoring} className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 text-lg">Start Match Scoring</button>
      )}

      {liveScore && currentInnings && (
        <div>
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <p className="text-xl font-bold">{currentInnings.totalRuns}/{currentInnings.totalWickets} ({liveScore.currentOver}.{liveScore.currentBall} ov)</p>
            <p className="text-sm text-gray-500">Innings {liveScore.currentInnings}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow mb-4">
            <h2 className="font-semibold mb-4">Record Ball</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <input placeholder="Batsman ID" value={ballForm.batsmanId} onChange={(e) => setBallForm({ ...ballForm, batsmanId: e.target.value })} className="border rounded px-3 py-2 text-sm" />
              <input placeholder="Bowler ID" value={ballForm.bowlerId} onChange={(e) => setBallForm({ ...ballForm, bowlerId: e.target.value })} className="border rounded px-3 py-2 text-sm" />
              <select value={ballForm.runs} onChange={(e) => setBallForm({ ...ballForm, runs: Number(e.target.value) })} className="border rounded px-3 py-2 text-sm">
                {[0,1,2,3,4,5,6].map((r) => <option key={r} value={r}>{r} runs</option>)}
              </select>
              <select value={ballForm.extras.type} onChange={(e) => setBallForm({ ...ballForm, extras: { type: e.target.value, runs: e.target.value !== 'none' ? 1 : 0 } })} className="border rounded px-3 py-2 text-sm">
                <option value="none">No Extra</option><option value="wide">Wide</option><option value="no_ball">No Ball</option><option value="bye">Bye</option><option value="leg_bye">Leg Bye</option>
              </select>
            </div>
            <div className="flex items-center space-x-4 mb-4">
              <label className="flex items-center space-x-2"><input type="checkbox" checked={ballForm.isWicket} onChange={(e) => setBallForm({ ...ballForm, isWicket: e.target.checked })} /><span className="text-sm">Wicket</span></label>
              {ballForm.isWicket && (
                <select value={ballForm.wicket.type} onChange={(e) => setBallForm({ ...ballForm, wicket: { ...ballForm.wicket, type: e.target.value } })} className="border rounded px-3 py-2 text-sm">
                  {['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </div>
            <div className="flex space-x-3">
              <button onClick={recordBall} className="bg-emerald-600 text-white px-6 py-2 rounded hover:bg-emerald-700">Record Ball</button>
              <button onClick={undoBall} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">Undo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveScoringPanel;
```

Create `frontend/admin-app/src/pages/AuctionControl.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { auctionSocket } from '../services/socket';
import toast from 'react-hot-toast';

const AuctionControl = () => {
  const { tournamentId } = useParams();
  const [auction, setAuction] = useState(null);

  const fetchAuction = () => api.get(`/auctions/${tournamentId}`).then(({ data }) => setAuction(data.data)).catch(() => setAuction(null));

  useEffect(() => {
    fetchAuction();
    auctionSocket.connect();
    auctionSocket.emit('join-auction', { tournamentId });
    auctionSocket.on('new-bid', fetchAuction);
    return () => { auctionSocket.disconnect(); };
  }, [tournamentId]);

  const action = async (path) => {
    try { await api.post(`/auctions/${tournamentId}/${path}`); toast.success(`Action: ${path}`); fetchAuction(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Auction Control</h1>

      {!auction && <button onClick={() => action('start')} className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 text-lg">Start Auction</button>}

      {auction && (
        <div>
          <div className="flex space-x-3 mb-6">
            {auction.status === 'live' && <button onClick={() => action('pause')} className="bg-yellow-500 text-white px-4 py-2 rounded">Pause</button>}
            {auction.status === 'paused' && <button onClick={() => action('resume')} className="bg-green-600 text-white px-4 py-2 rounded">Resume</button>}
            <button onClick={() => action('next-player')} className="bg-blue-600 text-white px-4 py-2 rounded">Next Player</button>
            {auction.currentBidderId && <button onClick={() => action('sell')} className="bg-emerald-600 text-white px-4 py-2 rounded">Sell</button>}
            {auction.currentPlayerId && !auction.currentBidderId && <button onClick={() => action('unsold')} className="bg-gray-600 text-white px-4 py-2 rounded">Unsold</button>}
            <button onClick={() => action('end')} className="bg-red-600 text-white px-4 py-2 rounded">End Auction</button>
          </div>

          {auction.currentPlayerId && (
            <div className="bg-white p-6 rounded-lg shadow mb-6 border-l-4 border-yellow-500">
              <h2 className="text-xl font-bold">Current: {auction.currentPlayerId.name || 'Player'}</h2>
              <p className="text-2xl font-bold text-emerald-600 mt-2">Bid: {auction.currentBid?.toLocaleString()}</p>
            </div>
          )}

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="font-semibold mb-3">Sold ({auction.soldPlayers.length})</h2>
            {auction.soldPlayers.map((sp, i) => (
              <div key={i} className="border-b py-2 flex justify-between text-sm"><span>{sp.playerId}</span><span className="font-bold">{sp.amount?.toLocaleString()}</span></div>
            ))}
            <p className="text-sm text-gray-500 mt-3">Remaining: {auction.remainingPlayers.length} | Unsold: {auction.unsoldPlayers.length}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuctionControl;
```

Create `frontend/admin-app/src/pages/TournamentDetail.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const TournamentDetail = () => {
  const { id } = useParams();
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    api.get(`/tournaments/${id}`).then(({ data }) => setTournament(data.data));
    api.get(`/tournaments/${id}/matches`).then(({ data }) => setMatches(data.data));
  }, [id]);

  const changeStatus = async (status) => {
    try { await api.put(`/tournaments/${id}/status`, { status }); toast.success(`Status changed to ${status}`); api.get(`/tournaments/${id}`).then(({ data }) => setTournament(data.data)); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (!tournament) return <div className="text-center py-20">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <div className="flex space-x-2">
          {['draft', 'registration', 'active', 'completed'].map((s) => (
            <button key={s} onClick={() => changeStatus(s)} disabled={tournament.status === s} className={`px-3 py-1 rounded text-xs capitalize ${tournament.status === s ? 'bg-emerald-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <p><strong>Format:</strong> {tournament.format}</p>
        <p><strong>Location:</strong> {tournament.location}</p>
        <p><strong>Status:</strong> {tournament.status}</p>
      </div>

      <div className="flex space-x-4 mb-6">
        <Link to={`/auctions/${id}`} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">Manage Auction</Link>
      </div>

      <h2 className="text-xl font-bold mb-4">Matches</h2>
      <div className="space-y-3">
        {matches.map((m) => (
          <div key={m._id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
            <div>
              <span className="font-medium">{m.team1Id?.name} vs {m.team2Id?.name}</span>
              <p className="text-sm text-gray-500">{new Date(m.date).toLocaleDateString()} | {m.venue}</p>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`text-xs px-2 py-1 rounded capitalize ${m.status === 'live' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{m.status}</span>
              {(m.status === 'upcoming' || m.status === 'live') && <Link to={`/matches/${m._id}/score`} className="text-sm text-emerald-600 hover:underline">Score</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TournamentDetail;
```

- [ ] **Step 4: Wire up admin App.jsx and main.jsx**

Replace `frontend/admin-app/src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AdminLayout from './components/AdminLayout';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import TournamentManagement from './pages/TournamentManagement';
import TournamentDetail from './pages/TournamentDetail';
import TeamManagement from './pages/TeamManagement';
import PlayerManagement from './pages/PlayerManagement';
import UserManagement from './pages/UserManagement';
import RegistrationManagement from './pages/RegistrationManagement';
import LiveScoringPanel from './pages/LiveScoringPanel';
import AuctionControl from './pages/AuctionControl';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tournaments" element={<TournamentManagement />} />
            <Route path="/tournaments/:id" element={<TournamentDetail />} />
            <Route path="/teams" element={<TeamManagement />} />
            <Route path="/players" element={<PlayerManagement />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/registrations" element={<RegistrationManagement />} />
            <Route path="/matches/:matchId/score" element={<LiveScoringPanel />} />
            <Route path="/auctions/:tournamentId" element={<AuctionControl />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
```

Replace `frontend/admin-app/src/main.jsx`:
```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 5: Test admin dashboard**

```bash
cd C:/laragon/www/sports-league/frontend/admin-app && npm run dev
```

Expected: Vite dev server on port 3001, loads admin login page.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add admin dashboard with all management pages, live scoring panel, and auction control"
```

---

## Phase 9: Final Integration

### Task 21: Initialize Git & Final Verification

- [ ] **Step 1: Initialize git repo**

```bash
cd C:/laragon/www/sports-league
git init
```

Create `.gitignore` at root:
```
node_modules/
.env
dist/
.DS_Store
```

- [ ] **Step 2: Run all three apps simultaneously**

Terminal 1:
```bash
cd C:/laragon/www/sports-league/backend && npm run dev
```

Terminal 2:
```bash
cd C:/laragon/www/sports-league/frontend/public-app && npm run dev
```

Terminal 3:
```bash
cd C:/laragon/www/sports-league/frontend/admin-app && npm run dev
```

Verify:
- Backend: `http://localhost:5000/api/health` returns `{ success: true }`
- Public: `http://localhost:3000` loads home page
- Admin: `http://localhost:3001` loads admin login

- [ ] **Step 3: Seed database and test login**

```bash
cd C:/laragon/www/sports-league/backend && npm run seed
```

Test admin login at `http://localhost:3001/login` with `admin@sportsleague.com / admin123`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Sports League Platform MVP complete — backend API, public frontend, admin dashboard"
```
