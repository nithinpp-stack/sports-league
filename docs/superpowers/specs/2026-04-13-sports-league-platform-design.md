# Sports League & Tournament Management Platform — Design Spec

**Date:** 2026-04-13
**Status:** Draft
**SRS Source:** Updated_SRS_Sports_Platform.docx (TSPLSPORTS PVT LTD, 23 March 2026)

---

## 1. Overview

A web-based platform for managing cricket tournaments, teams, players, auctions, and live scoring. The MVP focuses exclusively on cricket with sport-specific scoring (ball-by-ball, overs, wickets, runs).

**Key decisions:**
- Cricket-only MVP (multi-sport deferred to future enhancement)
- MongoDB database (Mongoose ODM)
- JWT + bcrypt authentication
- Shared backend API for both frontends
- Socket.IO for real-time features (live scoring + auctions)

---

## 2. System Architecture

```
┌──────────────────────┐  ┌──────────────────────┐
│   Public Frontend     │  │   Admin Dashboard     │
│   React + Vite        │  │   React + Vite        │
│   Port 3000           │  │   Port 3001           │
│   frontend/public-app │  │   frontend/admin-app  │
└──────────┬───────────┘  └──────────┬───────────┘
           │                          │
           └────────────┬─────────────┘
                        │
               ┌────────▼─────────┐
               │   Backend API     │
               │   Express.js      │
               │   Port 5000       │
               │   + Socket.IO     │
               │   backend/        │
               └────────┬─────────┘
                        │
               ┌────────▼─────────┐
               │     MongoDB       │
               │    (Mongoose)     │
               └──────────────────┘
```

### Directory Structure

```
sports-league/
├── frontend/
│   ├── public-app/          # Public-facing React app (port 3000)
│   │   ├── src/
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── pages/       # Route-level page components
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── services/    # API client (axios) + socket client
│   │   │   ├── context/     # Auth context, theme context
│   │   │   ├── utils/       # Helpers, formatters, constants
│   │   │   ├── assets/      # Images, icons
│   │   │   ├── App.jsx
│   │   │   └── main.jsx
│   │   ├── index.html
│   │   ├── tailwind.config.js
│   │   ├── vite.config.js
│   │   └── package.json
│   │
│   └── admin-app/           # Admin dashboard React app (port 3001)
│       ├── src/
│       │   ├── components/  # Admin UI components
│       │   ├── pages/       # Admin route-level pages
│       │   ├── hooks/
│       │   ├── services/    # API client + socket client
│       │   ├── context/
│       │   ├── utils/
│       │   ├── App.jsx
│       │   └── main.jsx
│       ├── index.html
│       ├── tailwind.config.js
│       ├── vite.config.js
│       └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/          # db.js, env.js, cors.js
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express route files
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/       # auth.js, authorize.js, validate.js, errorHandler.js
│   │   ├── services/        # Business logic layer
│   │   ├── socket/          # Socket.IO event handlers
│   │   │   ├── index.js     # Socket setup + namespace registration
│   │   │   ├── liveScoring.js
│   │   │   └── auction.js
│   │   ├── utils/           # Helpers, constants
│   │   ├── validators/      # express-validator schemas
│   │   └── app.js           # Express app setup
│   ├── server.js            # Entry point (starts HTTP + Socket.IO)
│   ├── .env
│   ├── .env.example
│   └── package.json
│
├── docs/
│   └── superpowers/
│       └── specs/
├── CLAUDE.md
└── package.json             # Root package.json (workspace scripts)
```

---

## 3. User Roles & Authentication

### Roles

| Role | Access | Description |
|------|--------|-------------|
| **super_admin** | Full platform control | Manages everything: tournaments, teams, users, auctions, scoring |
| **team_owner** | Team management + auction bidding | Manages their team, participates in auctions, views matches |
| **player** | Self-registration + profile | Registers for tournaments, views own profile and stats |
| **scorer** | Live score updates | Updates live scores for assigned matches (admin-appointed) |

**Public (unauthenticated):** Can view tournaments, live scores, standings, team/player profiles.

### Auth Implementation

- **Password hashing:** bcryptjs with 10 salt rounds
- **Access token:** JWT, 15-minute expiry, sent in `Authorization: Bearer <token>` header
- **Refresh token:** JWT, 7-day expiry, stored in httpOnly secure cookie
- **Token refresh:** `POST /api/auth/refresh` — issues new access token if refresh token is valid
- **Logout:** Clears refresh cookie; client discards access token

### Auth Middleware Chain

```
Request → authenticate(verifyJWT) → authorize(['super_admin', 'scorer']) → controller
```

- `authenticate`: Extracts + verifies JWT from Authorization header. Attaches `req.user`.
- `authorize(roles[])`: Checks `req.user.role` against allowed roles. Returns 403 if denied.

### Registration Flow

1. User registers with name, email, password, role (player or team_owner)
2. Super admin accounts are seeded or created by existing super admins only
3. Scorer accounts are created by super admins only

---

## 4. MongoDB Collections & Schemas

### users
```javascript
{
  name: String,           // required
  email: String,          // required, unique, lowercase
  password: String,       // required, hashed
  role: String,           // enum: super_admin, team_owner, player, scorer
  phone: String,
  avatar: String,         // URL
  isActive: Boolean,      // default: true
  createdAt: Date,
  updatedAt: Date
}
```

### tournaments
```javascript
{
  name: String,           // required
  sport: String,          // default: "cricket"
  format: String,         // enum: T20, ODI, Test
  location: String,
  venue: String,
  startDate: Date,
  endDate: Date,
  status: String,         // enum: draft, registration, active, completed, cancelled
  maxTeams: Number,       // default: 8
  description: String,
  createdBy: ObjectId,    // ref: users
  createdAt: Date,
  updatedAt: Date
}
```

### teams
```javascript
{
  name: String,           // required
  logo: String,           // URL
  ownerId: ObjectId,      // ref: users (team_owner)
  tournamentId: ObjectId, // ref: tournaments
  budget: Number,         // auction budget, default: 1000000
  remainingBudget: Number,
  playerCount: Number,    // default: 0
  maxPlayers: Number,     // default: 15
  createdAt: Date,
  updatedAt: Date
}
```

### players
```javascript
{
  name: String,           // required
  age: Number,
  skill: String,          // enum: batsman, bowler, allrounder, wicketkeeper
  battingStyle: String,   // enum: right-hand, left-hand
  bowlingStyle: String,   // enum: fast, medium, spin, none
  basePrice: Number,      // auction base price
  teamId: ObjectId,       // ref: teams (null if unsold/available)
  tournamentId: ObjectId, // ref: tournaments
  userId: ObjectId,       // ref: users (linked user account)
  status: String,         // enum: available, sold, unsold, registered
  stats: {
    matches: Number,
    runs: Number,
    wickets: Number,
    catches: Number,
    highestScore: Number,
    bestBowling: String,
    average: Number,
    strikeRate: Number,
    economyRate: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### matches
```javascript
{
  tournamentId: ObjectId, // ref: tournaments
  team1Id: ObjectId,      // ref: teams
  team2Id: ObjectId,      // ref: teams
  date: Date,
  venue: String,
  status: String,         // enum: upcoming, live, completed, cancelled
  tossWinner: ObjectId,   // ref: teams
  tossDecision: String,   // enum: bat, bowl
  result: {
    winner: ObjectId,     // ref: teams (null if tie/no result)
    winType: String,      // e.g., "runs", "wickets", "tie", "no_result"
    winMargin: Number,
    summary: String       // e.g., "Team A won by 5 wickets"
  },
  scorerId: ObjectId,     // ref: users (scorer assigned)
  manOfMatch: ObjectId,   // ref: players
  createdAt: Date,
  updatedAt: Date
}
```

### livescores
```javascript
{
  matchId: ObjectId,      // ref: matches, unique
  currentInnings: Number, // 1 or 2
  currentOver: Number,
  currentBall: Number,
  battingTeamId: ObjectId,
  bowlingTeamId: ObjectId,
  innings: [{
    inningsNumber: Number,
    battingTeamId: ObjectId,
    bowlingTeamId: ObjectId,
    totalRuns: Number,
    totalWickets: Number,
    totalOvers: Number,
    extras: {
      wides: Number,
      noBalls: Number,
      byes: Number,
      legByes: Number,
      total: Number
    },
    batsmen: [{
      playerId: ObjectId,
      runs: Number,
      balls: Number,
      fours: Number,
      sixes: Number,
      isOut: Boolean,
      dismissalType: String, // bowled, caught, lbw, run_out, stumped, hit_wicket, retired
      dismissedBy: ObjectId, // bowler/fielder
      strikeRate: Number
    }],
    bowlers: [{
      playerId: ObjectId,
      overs: Number,
      maidens: Number,
      runs: Number,
      wickets: Number,
      noBalls: Number,
      wides: Number,
      economyRate: Number
    }],
    overs: [{
      overNumber: Number,
      bowlerId: ObjectId,
      balls: [{
        ballNumber: Number,
        batsmanId: ObjectId,
        bowlerId: ObjectId,
        runs: Number,
        extras: { type: String, runs: Number },
        isWicket: Boolean,
        wicket: { type: String, playerId: ObjectId, fielderId: ObjectId },
        commentary: String
      }]
    }],
    fallOfWickets: [{
      wicketNumber: Number,
      playerId: ObjectId,
      runs: Number,  // team score at fall
      overs: Number
    }]
  }],
  lastUpdated: Date
}
```

### auctions
```javascript
{
  tournamentId: ObjectId, // ref: tournaments
  status: String,         // enum: pending, live, paused, completed
  currentPlayerId: ObjectId, // ref: players (currently being auctioned)
  currentBid: Number,
  currentBidderId: ObjectId, // ref: teams
  timer: Number,          // seconds remaining for current bid
  soldPlayers: [{
    playerId: ObjectId,
    teamId: ObjectId,
    amount: Number
  }],
  unsoldPlayers: [ObjectId],
  remainingPlayers: [ObjectId],
  createdAt: Date,
  updatedAt: Date
}
```

### bids
```javascript
{
  auctionId: ObjectId,    // ref: auctions
  playerId: ObjectId,     // ref: players
  teamId: ObjectId,       // ref: teams
  amount: Number,
  timestamp: Date
}
```

### registrations
```javascript
{
  playerId: ObjectId,     // ref: players or users
  tournamentId: ObjectId, // ref: tournaments
  status: String,         // enum: pending, approved, rejected
  appliedAt: Date,
  reviewedBy: ObjectId,   // ref: users (admin)
  reviewedAt: Date
}
```

---

## 5. API Routes

### Auth Routes (`/api/auth`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/register` | Public | Register new user (player/team_owner) |
| POST | `/login` | Public | Login, returns access + refresh tokens |
| POST | `/refresh` | Public | Refresh access token |
| POST | `/logout` | Auth | Clear refresh cookie |
| GET | `/me` | Auth | Get current user profile |

### User Routes (`/api/users`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Admin | List all users (paginated, filterable) |
| GET | `/:id` | Admin/Self | Get user by ID |
| PUT | `/:id` | Admin/Self | Update user |
| DELETE | `/:id` | Admin | Deactivate user |
| POST | `/create-scorer` | Admin | Create scorer account |

### Tournament Routes (`/api/tournaments`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | List tournaments (paginated, filterable by status) |
| GET | `/:id` | Public | Get tournament details |
| POST | `/` | Admin | Create tournament |
| PUT | `/:id` | Admin | Update tournament |
| DELETE | `/:id` | Admin | Delete tournament (draft only) |
| GET | `/:id/standings` | Public | Get tournament standings |
| GET | `/:id/teams` | Public | Get teams in tournament |
| GET | `/:id/matches` | Public | Get matches in tournament |
| PUT | `/:id/status` | Admin | Change tournament status |

### Team Routes (`/api/teams`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | List teams (filterable by tournament) |
| GET | `/:id` | Public | Get team details with roster |
| POST | `/` | Admin | Create team |
| PUT | `/:id` | Admin/Owner | Update team |
| DELETE | `/:id` | Admin | Delete team |
| GET | `/:id/players` | Public | Get team roster |

### Player Routes (`/api/players`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | List players (filterable) |
| GET | `/:id` | Public | Get player with stats |
| POST | `/` | Admin | Create player |
| PUT | `/:id` | Admin/Self | Update player |
| POST | `/register-tournament` | Player | Register for tournament |

### Match Routes (`/api/matches`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | List matches (filterable by tournament, status, date) |
| GET | `/:id` | Public | Get match details |
| POST | `/` | Admin | Create/schedule match |
| PUT | `/:id` | Admin | Update match details |
| DELETE | `/:id` | Admin | Delete match (upcoming only) |
| PUT | `/:id/assign-scorer` | Admin | Assign scorer to match |
| GET | `/live` | Public | Get all currently live matches |

### Live Score Routes (`/api/livescores`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/:matchId` | Public | Get live scorecard |
| POST | `/:matchId/start` | Scorer/Admin | Start match scoring |
| POST | `/:matchId/ball` | Scorer/Admin | Record a ball |
| POST | `/:matchId/end-innings` | Scorer/Admin | End current innings |
| POST | `/:matchId/end-match` | Scorer/Admin | End match with result |
| GET | `/:matchId/scorecard` | Public | Get full scorecard |
| POST | `/:matchId/undo` | Scorer/Admin | Undo last ball |

### Auction Routes (`/api/auctions`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/:tournamentId` | Auth | Get auction state |
| POST | `/:tournamentId/start` | Admin | Start auction |
| POST | `/:tournamentId/pause` | Admin | Pause auction |
| POST | `/:tournamentId/resume` | Admin | Resume auction |
| POST | `/:tournamentId/end` | Admin | End auction |
| POST | `/:tournamentId/next-player` | Admin | Put next player up for bid |
| POST | `/:tournamentId/bid` | Team Owner | Place bid |
| POST | `/:tournamentId/sell` | Admin | Sell player to highest bidder |
| POST | `/:tournamentId/unsold` | Admin | Mark player as unsold |

### Dashboard Routes (`/api/dashboard`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/admin/stats` | Admin | Overview stats (counts, active items) |
| GET | `/admin/recent-activity` | Admin | Recent platform activity |
| GET | `/team/:teamId` | Owner | Team dashboard stats |

---

## 6. Socket.IO Real-Time Events

### Live Scoring Namespace (`/live-scoring`)

**Rooms:** Each match gets a room: `match:{matchId}`

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join-match` | Client → Server | `{ matchId }` | Join match room |
| `leave-match` | Client → Server | `{ matchId }` | Leave match room |
| `ball-update` | Server → Room | `{ ball, score, over, innings }` | New ball recorded |
| `wicket` | Server → Room | `{ batsman, bowler, type, score }` | Wicket fallen |
| `innings-end` | Server → Room | `{ innings, summary }` | Innings completed |
| `match-end` | Server → Room | `{ result, scorecard }` | Match completed |
| `score-correction` | Server → Room | `{ correction }` | Undo/correction applied |

### Auction Namespace (`/auction`)

**Rooms:** Each auction gets a room: `auction:{tournamentId}`

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `join-auction` | Client → Server | `{ tournamentId }` | Join auction room |
| `new-player` | Server → Room | `{ player, basePrice }` | New player up for bid |
| `new-bid` | Server → Room | `{ teamId, teamName, amount }` | Bid placed |
| `player-sold` | Server → Room | `{ player, team, amount }` | Player sold |
| `player-unsold` | Server → Room | `{ player }` | Player unsold |
| `auction-paused` | Server → Room | `{}` | Auction paused |
| `auction-ended` | Server → Room | `{ summary }` | Auction completed |
| `timer-update` | Server → Room | `{ seconds }` | Bid timer countdown |

---

## 7. Frontend Pages

### Public App (port 3000)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Hero, active tournaments, live match ticker |
| `/login` | Login | Email + password login form |
| `/register` | Register | Registration form (player/team_owner) |
| `/tournaments` | Tournament List | All tournaments with filters (status, date) |
| `/tournaments/:id` | Tournament Detail | Info, standings, schedule, teams |
| `/matches` | Match List | Upcoming + recent matches |
| `/matches/:id` | Match Detail | Scorecard + live score (Socket.IO) |
| `/matches/live` | Live Matches | All currently live matches |
| `/teams/:id` | Team Profile | Team info, roster, match history |
| `/players/:id` | Player Profile | Player info, stats, match history |
| `/auctions/:tournamentId` | Auction Viewer | Live auction feed (Socket.IO) |
| `/profile` | User Profile | View/edit own profile (auth required) |

### Admin Dashboard (port 3001)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Stats overview, charts, recent activity |
| `/login` | Admin Login | Login (super_admin/scorer only) |
| `/tournaments` | Tournament Mgmt | CRUD list with status badges |
| `/tournaments/:id` | Tournament Detail | Edit, manage teams/matches/auction |
| `/tournaments/:id/matches` | Match Scheduling | Create/edit matches, assign scorers |
| `/teams` | Team Mgmt | CRUD list, assign owners |
| `/teams/:id` | Team Detail | Edit, manage roster, budget |
| `/players` | Player Mgmt | CRUD list, approve registrations |
| `/matches/:id/score` | Live Scoring Panel | Ball-by-ball input UI for scorers |
| `/auctions/:tournamentId` | Auction Control | Start/pause/end, manage bids |
| `/users` | User Mgmt | CRUD list, role management |
| `/registrations` | Registrations | Approve/reject player registrations |

---

## 8. Key Libraries & Dependencies

### Backend (`backend/package.json`)
```
express             - HTTP framework
mongoose            - MongoDB ODM
socket.io           - WebSocket server
jsonwebtoken        - JWT creation/verification
bcryptjs            - Password hashing
cors                - Cross-origin resource sharing
dotenv              - Environment variables
express-validator   - Request validation
helmet              - Security headers
morgan              - HTTP request logging
cookie-parser       - Parse cookies (refresh tokens)
nodemon             - Dev auto-restart
```

### Frontend Apps (`frontend/*/package.json`)
```
react               - UI library
react-dom           - DOM rendering
react-router-dom    - Client-side routing
axios               - HTTP client
socket.io-client    - WebSocket client
@tanstack/react-query - Server state management
tailwindcss         - Utility-first CSS
@headlessui/react   - Accessible UI primitives
react-hot-toast     - Toast notifications
dayjs               - Date formatting
recharts            - Charts (admin dashboard)
react-icons         - Icon library
```

---

## 9. Non-Functional Requirements

- **Security:** Helmet headers, CORS whitelist (ports 3000, 3001), rate limiting on auth routes, input validation on all endpoints, parameterized Mongoose queries
- **Performance:** Mongoose indexes on frequently queried fields (email, tournamentId, matchId, status). Pagination on all list endpoints (default 20, max 100). Socket.IO rooms to scope broadcasts.
- **Responsiveness:** Tailwind CSS responsive utilities. Mobile-first design for public app. Admin optimized for desktop but usable on tablet.
- **Error Handling:** Centralized error handler middleware. Consistent error response format: `{ success: false, message, errors[] }`. Success format: `{ success: true, data, pagination? }`

---

## 10. Environment Variables

```env
# Backend (.env)
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sports-league
JWT_SECRET=<random-secret>
JWT_EXPIRE=15m
JWT_REFRESH_SECRET=<random-secret>
JWT_REFRESH_EXPIRE=7d
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

---

## 11. MVP Scope (Phase 1)

**In scope:**
1. User authentication (register, login, JWT flow)
2. Tournament CRUD + status management
3. Team CRUD + owner assignment
4. Player CRUD + registration flow
5. Match scheduling + basic result entry
6. Live scoring (ball-by-ball cricket scoring via Socket.IO)
7. Auction system (live bidding with real-time updates)
8. Admin dashboard with all management features
9. Public frontend with tournament/match/team/player views

**Out of scope (future enhancements):**
- Payment integration
- In-app chat/messaging
- Advanced analytics and visualizations
- Progressive Web App (PWA)
- Multi-sport support
- Push notifications
- Social media integration
- Advanced auction features (RTM, retention)

---

## 12. Seed Data

The backend will include a seed script (`backend/src/utils/seed.js`) that creates:
- 1 super_admin user (admin@sportsleague.com / admin123)
- 2 team_owner users
- 2 scorer users
- 5 player users
- 1 sample tournament (T20 format)
- 4 teams with budgets
- 20 players distributed across skill types
- 4 sample matches (various statuses)

---

## 13. API Response Format

All API responses follow a consistent format:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Email is required" }
  ]
}
```
