# Sports League & Tournament Management Platform

## Project Overview
Cricket-focused tournament management platform with live scoring, team management, player auctions, and real-time updates.

## Tech Stack
- **Backend:** Node.js + Express.js + Mongoose + Socket.IO (port 5000)
- **Frontend (Public):** React + Vite + TailwindCSS (port 3000)
- **Frontend (Admin):** React + Vite + TailwindCSS (port 3001)
- **Database:** MongoDB
- **Auth:** JWT (access + refresh tokens) + bcryptjs
- **Real-time:** Socket.IO (live scoring + auction bidding)

## Directory Structure
```
sports-league/
├── frontend/
│   ├── public-app/    # Public React app (port 3000)
│   └── admin-app/     # Admin dashboard React app (port 3001)
├── backend/           # Express API + Socket.IO (port 5000)
│   └── src/
│       ├── config/
│       ├── models/
│       ├── routes/
│       ├── controllers/
│       ├── middleware/
│       ├── services/
│       ├── socket/
│       ├── validators/
│       └── utils/
└── docs/
```

## Running the Project
```bash
# Backend
cd backend && npm install && npm run dev

# Public frontend
cd frontend/public-app && npm install && npm run dev

# Admin dashboard
cd frontend/admin-app && npm install && npm run dev
```

## Key Conventions
- **API responses:** Always use `{ success: true/false, data, message, errors[], pagination? }`
- **Auth middleware chain:** `authenticate` -> `authorize(roles[])` -> controller
- **Roles:** super_admin, team_owner, player, scorer
- **Mongoose models:** PascalCase singular (User, Tournament, Match, LiveScore)
- **Routes:** kebab-case, RESTful (`/api/tournaments/:id/standings`)
- **Controllers:** One file per resource, async/await with try-catch
- **Validation:** express-validator in separate validator files
- **Environment:** All config via .env (never hardcode secrets)

## Database
- MongoDB with Mongoose ODM
- Collections: users, tournaments, teams, players, matches, livescores, auctions, bids, registrations
- Index frequently queried fields (email, tournamentId, matchId, status)

## Socket.IO Namespaces
- `/live-scoring` — Ball-by-ball match updates (rooms per match)
- `/auction` — Real-time auction bidding (rooms per tournament)

## Design Spec
Full design document: `docs/superpowers/specs/2026-04-13-sports-league-platform-design.md`
