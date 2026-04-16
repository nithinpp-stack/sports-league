import 'dotenv/config';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Player from '../models/Player.js';
import Match from '../models/Match.js';
import Role from '../models/Role.js';
import Manager from '../models/Manager.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear collections
    await Promise.all([
      Admin.deleteMany({}),
      User.deleteMany({}),
      Tournament.deleteMany({}),
      Team.deleteMany({}),
      Player.deleteMany({}),
      Match.deleteMany({}),
      Role.deleteMany({}),
      Manager.deleteMany({}),
    ]);
    console.log('Cleared all collections');

    // --- Default Roles ---
    const superAdminRole = await Role.create({
      name: 'Super Admin',
      level: 1,
      status: 'active',
      permissions: ['*'],
      isDefault: true,
    });

    const eventManagerRole = await Role.create({
      name: 'Event Manager',
      level: 2,
      status: 'active',
      permissions: [
        'dashboard.access',
        'tournaments.view', 'tournaments.create', 'tournaments.edit', 'tournaments.delete',
        'teams.view', 'teams.create', 'teams.edit', 'teams.delete',
        'managers.view', 'managers.create', 'managers.delete',
        'players.view', 'players.create', 'players.edit', 'players.assign',
        'matches.view', 'matches.create', 'matches.edit', 'matches.delete', 'matches.score',
        'auctions.view', 'auctions.manage',
        'registrations.view', 'registrations.manage',
      ],
      isDefault: true,
    });

    const managerRole = await Role.create({
      name: 'Manager',
      level: 3,
      status: 'active',
      permissions: [
        'dashboard.access',
        'teams.view',
        'players.view', 'players.assign',
        'auctions.view', 'auctions.bid',
        'tournaments.view',
      ],
      isDefault: true,
    });

    console.log('Created default roles');

    // --- Admins ---
    const superAdmin = await Admin.create({
      name: 'Admin User',
      email: 'admin@sportsleague.com',
      password: 'admin123',
      roleId: superAdminRole._id,
    });

    const eventMgr1 = await Admin.create({
      name: 'Event Manager One',
      email: 'eventmgr1@sportsleague.com',
      password: 'eventmgr123',
      roleId: eventManagerRole._id,
    });

    const eventMgr2 = await Admin.create({
      name: 'Event Manager Two',
      email: 'eventmgr2@sportsleague.com',
      password: 'eventmgr123',
      roleId: eventManagerRole._id,
    });

    console.log('Created admins');

    // --- Player Users ---
    const playerUsers = [];
    for (let i = 1; i <= 5; i++) {
      const pu = await User.create({ name: `Player User ${i}`, email: `player${i}@sportsleague.com`, password: 'player123', role: 'player' });
      playerUsers.push(pu);
    }

    console.log('Created player users');

    // --- Tournament ---
    const tournament = await Tournament.create({
      name: 'Mumbai T20 Premier League',
      sport: 'cricket',
      format: 'T20',
      location: 'Mumbai',
      venue: 'Wankhede Stadium',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      status: 'active',
      maxTeams: 4,
      description: 'Premier T20 tournament in Mumbai',
      createdBy: eventMgr1._id,
    });

    console.log('Created cricket tournament');

    // --- Cricket Managers ---
    const manager1 = await Manager.create({ name: 'Manager One', email: 'manager1@sportsleague.com', tournamentId: tournament._id });
    const manager2 = await Manager.create({ name: 'Manager Two', email: 'manager2@sportsleague.com', tournamentId: tournament._id });

    console.log('Created cricket managers');

    // --- Teams ---
    const teams = await Team.insertMany([
      {
        name: 'Mumbai Warriors',
        managerId: manager1._id,
        tournamentId: tournament._id,
        totalPoints: 1000,
        remainingPoints: 750,
        playerCount: 5,
        maxPlayers: 15,
      },
      {
        name: 'Delhi Destroyers',
        managerId: manager2._id,
        tournamentId: tournament._id,
        totalPoints: 1000,
        remainingPoints: 700,
        playerCount: 5,
        maxPlayers: 15,
      },
      {
        name: 'Chennai Kings',
        tournamentId: tournament._id,
        totalPoints: 1000,
        remainingPoints: 800,
        playerCount: 5,
        maxPlayers: 15,
      },
      {
        name: 'Bangalore Bears',
        tournamentId: tournament._id,
        totalPoints: 1000,
        remainingPoints: 850,
        playerCount: 5,
        maxPlayers: 15,
      },
    ]);

    const [teamA, teamB, teamC, teamD] = teams;
    console.log('Created 4 cricket teams');

    // --- Players (20 total, 5 per team) ---
    const playerData = [
      // Team A - Mumbai Warriors
      { name: 'Rahul Sharma', age: 28, skill: 'batsman', battingStyle: 'right-hand', bowlingStyle: 'none', basePrice: 100000, teamId: teamA._id, status: 'sold' },
      { name: 'Amit Patel', age: 25, skill: 'bowler', battingStyle: 'right-hand', bowlingStyle: 'fast', basePrice: 80000, teamId: teamA._id, status: 'sold' },
      { name: 'Suresh Kumar', age: 30, skill: 'allrounder', battingStyle: 'left-hand', bowlingStyle: 'medium', basePrice: 120000, teamId: teamA._id, status: 'sold' },
      { name: 'Vikram Singh', age: 27, skill: 'wicketkeeper', battingStyle: 'right-hand', bowlingStyle: 'none', basePrice: 90000, teamId: teamA._id, status: 'sold' },
      { name: 'Nitin Joshi', age: 24, skill: 'batsman', battingStyle: 'left-hand', bowlingStyle: 'none', basePrice: 70000, teamId: teamA._id, status: 'sold' },
      // Team B - Delhi Destroyers
      { name: 'Karan Mehta', age: 29, skill: 'batsman', battingStyle: 'right-hand', bowlingStyle: 'none', basePrice: 110000, teamId: teamB._id, status: 'sold' },
      { name: 'Ravi Yadav', age: 26, skill: 'bowler', battingStyle: 'right-hand', bowlingStyle: 'spin', basePrice: 85000, teamId: teamB._id, status: 'sold' },
      { name: 'Pradeep Nair', age: 31, skill: 'allrounder', battingStyle: 'right-hand', bowlingStyle: 'medium', basePrice: 130000, teamId: teamB._id, status: 'sold' },
      { name: 'Sanjay Gupta', age: 28, skill: 'wicketkeeper', battingStyle: 'left-hand', bowlingStyle: 'none', basePrice: 95000, teamId: teamB._id, status: 'sold' },
      { name: 'Deepak Chauhan', age: 23, skill: 'bowler', battingStyle: 'right-hand', bowlingStyle: 'fast', basePrice: 75000, teamId: teamB._id, status: 'sold' },
      // Team C - Chennai Kings
      { name: 'Arjun Reddy', age: 27, skill: 'batsman', battingStyle: 'right-hand', bowlingStyle: 'none', basePrice: 105000, teamId: teamC._id, status: 'sold' },
      { name: 'Mohan Das', age: 25, skill: 'bowler', battingStyle: 'left-hand', bowlingStyle: 'spin', basePrice: 82000, teamId: teamC._id, status: 'sold' },
      { name: 'Kartik Iyer', age: 29, skill: 'allrounder', battingStyle: 'right-hand', bowlingStyle: 'fast', basePrice: 115000, teamId: teamC._id, status: 'sold' },
      { name: 'Raj Pillai', age: 26, skill: 'wicketkeeper', battingStyle: 'right-hand', bowlingStyle: 'none', basePrice: 88000, teamId: teamC._id, status: 'sold' },
      { name: 'Anand Krishnan', age: 24, skill: 'batsman', battingStyle: 'left-hand', bowlingStyle: 'none', basePrice: 72000, teamId: teamC._id, status: 'sold' },
      // Team D - Bangalore Bears
      { name: 'Siddharth Rao', age: 28, skill: 'batsman', battingStyle: 'right-hand', bowlingStyle: 'none', basePrice: 108000, teamId: teamD._id, status: 'sold' },
      { name: 'Tushar Bhatt', age: 27, skill: 'bowler', battingStyle: 'right-hand', bowlingStyle: 'medium', basePrice: 86000, teamId: teamD._id, status: 'sold' },
      { name: 'Naveen Patil', age: 30, skill: 'allrounder', battingStyle: 'left-hand', bowlingStyle: 'spin', basePrice: 125000, teamId: teamD._id, status: 'sold' },
      { name: 'Hemant Shah', age: 25, skill: 'wicketkeeper', battingStyle: 'right-hand', bowlingStyle: 'none', basePrice: 92000, teamId: teamD._id, status: 'sold' },
      { name: 'Jitendra More', age: 23, skill: 'bowler', battingStyle: 'right-hand', bowlingStyle: 'fast', basePrice: 78000, teamId: teamD._id, status: 'sold' },
    ];

    const playersWithTournament = playerData.map(p => ({ ...p, tournamentId: tournament._id }));
    await Player.insertMany(playersWithTournament);

    console.log('Created 20 cricket players');

    // --- Cricket Matches ---
    const now = new Date();
    const pastDate1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pastDate2 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const futureDate1 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const futureDate2 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await Match.insertMany([
      {
        tournamentId: tournament._id,
        team1Id: teamA._id,
        team2Id: teamB._id,
        date: pastDate1,
        venue: 'Wankhede Stadium',
        status: 'completed',
        tossWinner: teamA._id,
        tossDecision: 'bat',
        result: {
          winner: teamA._id,
          winType: 'runs',
          winMargin: 25,
          summary: 'Mumbai Warriors beat Delhi Destroyers by 25 runs',
        },
        scorerId: eventMgr1._id,
      },
      {
        tournamentId: tournament._id,
        team1Id: teamC._id,
        team2Id: teamD._id,
        date: pastDate2,
        venue: 'Wankhede Stadium',
        status: 'completed',
        tossWinner: teamD._id,
        tossDecision: 'bowl',
        result: {
          winner: teamD._id,
          winType: 'wickets',
          winMargin: 4,
          summary: 'Bangalore Bears beat Chennai Kings by 4 wickets',
        },
        scorerId: eventMgr2._id,
      },
      {
        tournamentId: tournament._id,
        team1Id: teamA._id,
        team2Id: teamC._id,
        date: futureDate1,
        venue: 'Wankhede Stadium',
        status: 'upcoming',
      },
      {
        tournamentId: tournament._id,
        team1Id: teamB._id,
        team2Id: teamD._id,
        date: futureDate2,
        venue: 'Wankhede Stadium',
        status: 'upcoming',
      },
    ]);

    console.log('Created 4 cricket matches');

    // ============================================================
    // --- Football Data ---
    // ============================================================

    const footballTournament = await Tournament.create({
      name: 'City Football League 2026',
      sport: 'football',
      format: 'League',
      location: 'London',
      venue: 'City Stadium',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-08-31'),
      status: 'active',
      maxTeams: 4,
      createdBy: eventMgr2._id,
    });

    console.log('Created football tournament');

    // --- Football Managers ---
    const ftManager1 = await Manager.create({ name: 'Football Manager One', email: 'ftmanager1@sportsleague.com', tournamentId: footballTournament._id });
    const ftManager2 = await Manager.create({ name: 'Football Manager Two', email: 'ftmanager2@sportsleague.com', tournamentId: footballTournament._id });

    console.log('Created football managers');

    // --- Football Teams ---
    const footballTeams = await Team.insertMany([
      {
        name: 'City FC',
        managerId: ftManager1._id,
        tournamentId: footballTournament._id,
        totalPoints: 5000,
        remainingPoints: 4000,
        playerCount: 5,
        maxPlayers: 15,
      },
      {
        name: 'United FC',
        managerId: ftManager2._id,
        tournamentId: footballTournament._id,
        totalPoints: 5000,
        remainingPoints: 4000,
        playerCount: 5,
        maxPlayers: 15,
      },
      {
        name: 'Rovers FC',
        tournamentId: footballTournament._id,
        totalPoints: 5000,
        remainingPoints: 4000,
        playerCount: 5,
        maxPlayers: 15,
      },
      {
        name: 'Athletic FC',
        tournamentId: footballTournament._id,
        totalPoints: 5000,
        remainingPoints: 4000,
        playerCount: 5,
        maxPlayers: 15,
      },
    ]);

    const [ftA, ftB, ftC, ftD] = footballTeams;
    console.log('Created 4 football teams');

    // --- Football Players (20 total, 5 per team) ---
    const footballPlayerData = [
      // City FC
      { name: 'Marco Silva', age: 27, sport: 'football', skill: 'goalkeeper', basePrice: 200000, teamId: ftA._id, status: 'sold', footballStats: { matches: 10, goals: 0, assists: 1, yellowCards: 1, redCards: 0, cleanSheets: 4, minutesPlayed: 900 } },
      { name: 'James Wilson', age: 25, sport: 'football', skill: 'defender', basePrice: 180000, teamId: ftA._id, status: 'sold', footballStats: { matches: 10, goals: 1, assists: 2, yellowCards: 2, redCards: 0, cleanSheets: 0, minutesPlayed: 870 } },
      { name: 'Lucas Fernandez', age: 24, sport: 'football', skill: 'midfielder', basePrice: 220000, teamId: ftA._id, status: 'sold', footballStats: { matches: 10, goals: 5, assists: 7, yellowCards: 1, redCards: 0, cleanSheets: 0, minutesPlayed: 850 } },
      { name: 'Tom Hughes', age: 23, sport: 'football', skill: 'forward', basePrice: 250000, teamId: ftA._id, status: 'sold', footballStats: { matches: 10, goals: 12, assists: 4, yellowCards: 0, redCards: 0, cleanSheets: 0, minutesPlayed: 820 } },
      { name: 'Carlos Mendez', age: 29, sport: 'football', skill: 'defender', basePrice: 175000, teamId: ftA._id, status: 'sold', footballStats: { matches: 9, goals: 0, assists: 1, yellowCards: 3, redCards: 0, cleanSheets: 0, minutesPlayed: 780 } },
      // United FC
      { name: 'Oliver Grant', age: 26, sport: 'football', skill: 'goalkeeper', basePrice: 210000, teamId: ftB._id, status: 'sold', footballStats: { matches: 10, goals: 0, assists: 0, yellowCards: 0, redCards: 0, cleanSheets: 5, minutesPlayed: 900 } },
      { name: 'Pierre Dubois', age: 28, sport: 'football', skill: 'defender', basePrice: 190000, teamId: ftB._id, status: 'sold', footballStats: { matches: 10, goals: 2, assists: 1, yellowCards: 1, redCards: 0, cleanSheets: 0, minutesPlayed: 860 } },
      { name: 'Kai Müller', age: 22, sport: 'football', skill: 'midfielder', basePrice: 230000, teamId: ftB._id, status: 'sold', footballStats: { matches: 10, goals: 4, assists: 9, yellowCards: 2, redCards: 0, cleanSheets: 0, minutesPlayed: 840 } },
      { name: 'Ryan Brooks', age: 24, sport: 'football', skill: 'forward', basePrice: 260000, teamId: ftB._id, status: 'sold', footballStats: { matches: 10, goals: 15, assists: 5, yellowCards: 1, redCards: 0, cleanSheets: 0, minutesPlayed: 810 } },
      { name: 'Emre Yilmaz', age: 27, sport: 'football', skill: 'midfielder', basePrice: 215000, teamId: ftB._id, status: 'sold', footballStats: { matches: 9, goals: 3, assists: 6, yellowCards: 2, redCards: 1, cleanSheets: 0, minutesPlayed: 730 } },
      // Rovers FC
      { name: 'Stefan Novak', age: 30, sport: 'football', skill: 'goalkeeper', basePrice: 195000, teamId: ftC._id, status: 'sold', footballStats: { matches: 10, goals: 0, assists: 0, yellowCards: 1, redCards: 0, cleanSheets: 3, minutesPlayed: 900 } },
      { name: 'Ben Clarke', age: 26, sport: 'football', skill: 'defender', basePrice: 185000, teamId: ftC._id, status: 'sold', footballStats: { matches: 10, goals: 1, assists: 3, yellowCards: 0, redCards: 0, cleanSheets: 0, minutesPlayed: 880 } },
      { name: 'Diego Morales', age: 25, sport: 'football', skill: 'midfielder', basePrice: 225000, teamId: ftC._id, status: 'sold', footballStats: { matches: 10, goals: 6, assists: 8, yellowCards: 1, redCards: 0, cleanSheets: 0, minutesPlayed: 855 } },
      { name: 'Alex Turner', age: 23, sport: 'football', skill: 'forward', basePrice: 245000, teamId: ftC._id, status: 'sold', footballStats: { matches: 10, goals: 10, assists: 3, yellowCards: 2, redCards: 0, cleanSheets: 0, minutesPlayed: 800 } },
      { name: 'Luca Romano', age: 28, sport: 'football', skill: 'defender', basePrice: 180000, teamId: ftC._id, status: 'sold', footballStats: { matches: 9, goals: 0, assists: 2, yellowCards: 3, redCards: 0, cleanSheets: 0, minutesPlayed: 765 } },
      // Athletic FC
      { name: 'Nathan Price', age: 29, sport: 'football', skill: 'goalkeeper', basePrice: 205000, teamId: ftD._id, status: 'sold', footballStats: { matches: 10, goals: 0, assists: 0, yellowCards: 0, redCards: 0, cleanSheets: 6, minutesPlayed: 900 } },
      { name: 'Andrés García', age: 27, sport: 'football', skill: 'defender', basePrice: 188000, teamId: ftD._id, status: 'sold', footballStats: { matches: 10, goals: 2, assists: 1, yellowCards: 2, redCards: 0, cleanSheets: 0, minutesPlayed: 865 } },
      { name: 'Joe Mitchell', age: 24, sport: 'football', skill: 'midfielder', basePrice: 218000, teamId: ftD._id, status: 'sold', footballStats: { matches: 10, goals: 7, assists: 10, yellowCards: 1, redCards: 0, cleanSheets: 0, minutesPlayed: 845 } },
      { name: 'Fabio Costa', age: 26, sport: 'football', skill: 'forward', basePrice: 255000, teamId: ftD._id, status: 'sold', footballStats: { matches: 10, goals: 18, assists: 6, yellowCards: 0, redCards: 0, cleanSheets: 0, minutesPlayed: 830 } },
      { name: 'Harry Evans', age: 22, sport: 'football', skill: 'midfielder', basePrice: 200000, teamId: ftD._id, status: 'sold', footballStats: { matches: 8, goals: 2, assists: 4, yellowCards: 1, redCards: 0, cleanSheets: 0, minutesPlayed: 640 } },
    ];

    const footballPlayersWithTournament = footballPlayerData.map(p => ({
      ...p,
      tournamentId: footballTournament._id,
    }));
    await Player.insertMany(footballPlayersWithTournament);

    console.log('Created 20 football players');

    // --- Football Matches ---
    const fbPastDate1 = new Date('2026-06-15');
    const fbPastDate2 = new Date('2026-06-22');
    const fbFutureDate1 = new Date('2026-07-05');
    const fbFutureDate2 = new Date('2026-07-12');

    await Match.insertMany([
      {
        tournamentId: footballTournament._id,
        team1Id: ftA._id,
        team2Id: ftB._id,
        date: fbPastDate1,
        venue: 'City Stadium',
        status: 'completed',
        result: {
          winner: ftA._id,
          winType: 'goals',
          winMargin: 2,
          summary: 'City FC won 3-1',
        },
        scorerId: eventMgr1._id,
      },
      {
        tournamentId: footballTournament._id,
        team1Id: ftC._id,
        team2Id: ftD._id,
        date: fbPastDate2,
        venue: 'City Stadium',
        status: 'completed',
        result: {
          winner: ftD._id,
          winType: 'goals',
          winMargin: 1,
          summary: 'Athletic FC won 2-1',
        },
        scorerId: eventMgr2._id,
      },
      {
        tournamentId: footballTournament._id,
        team1Id: ftA._id,
        team2Id: ftC._id,
        date: fbFutureDate1,
        venue: 'City Stadium',
        status: 'upcoming',
      },
      {
        tournamentId: footballTournament._id,
        team1Id: ftB._id,
        team2Id: ftD._id,
        date: fbFutureDate2,
        venue: 'City Stadium',
        status: 'upcoming',
      },
    ]);

    console.log('Created 4 football matches');

    // --- Print credentials ---
    console.log('\n========== SEED COMPLETE ==========');
    console.log('\nAdmin Credentials (Admin collection):');
    console.log('  Super Admin:      admin@sportsleague.com / admin123 (Super Admin)');
    console.log('  Event Manager 1:  eventmgr1@sportsleague.com / eventmgr123 (Event Manager)');
    console.log('  Event Manager 2:  eventmgr2@sportsleague.com / eventmgr123 (Event Manager)');
    console.log('\nManagers (Manager collection — no login):');
    console.log('  [Cricket] Manager One:         manager1@sportsleague.com → Mumbai Warriors');
    console.log('  [Cricket] Manager Two:         manager2@sportsleague.com → Delhi Destroyers');
    console.log('  [Football] Football Manager One: ftmanager1@sportsleague.com → City FC');
    console.log('  [Football] Football Manager Two: ftmanager2@sportsleague.com → United FC');
    console.log('\nUser Credentials (User collection):');
    console.log('  Player 1:  player1@sportsleague.com / player123 (player)');
    console.log('  Player 2:  player2@sportsleague.com / player123 (player)');
    console.log('  Player 3:  player3@sportsleague.com / player123 (player)');
    console.log('  Player 4:  player4@sportsleague.com / player123 (player)');
    console.log('  Player 5:  player5@sportsleague.com / player123 (player)');
    console.log('\nData created:');
    console.log('  [Cricket] Tournament: Mumbai T20 Premier League (active) — created by eventmgr1');
    console.log('  [Cricket] Teams: 4 (Mumbai Warriors, Delhi Destroyers, Chennai Kings, Bangalore Bears)');
    console.log('  [Cricket] Players: 20 (5 per team)');
    console.log('  [Cricket] Matches: 4 (2 completed, 2 upcoming)');
    console.log('  [Football] Tournament: City Football League 2026 (active) — created by eventmgr2');
    console.log('  [Football] Teams: 4 (City FC, United FC, Rovers FC, Athletic FC)');
    console.log('  [Football] Players: 20 (5 per team, goalkeeper/defender/midfielder/forward)');
    console.log('  [Football] Matches: 4 (2 completed, 2 upcoming)');
    console.log('====================================\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
