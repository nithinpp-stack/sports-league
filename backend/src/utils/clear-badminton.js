// One-shot cleanup: wipe every record tied to badminton so the user can
// re-seed / manually test from a clean slate. Scope is intentionally narrow —
// cricket & football data is untouched.
//
// Deletion order follows dependency direction:
//   Bids -> Auctions -> LiveScores -> Matches -> Registrations -> Players
//   -> Teams -> Managers -> Tournaments
//
// User accounts (role='manager') are left alone: a manager could have logins
// re-used elsewhere, and an unused login is cheaper than a broken one.
//
// Run:  node src/utils/clear-badminton.js
import 'dotenv/config';
import mongoose from 'mongoose';

import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Player from '../models/Player.js';
import Match from '../models/Match.js';
import LiveScore from '../models/LiveScore.js';
import Auction from '../models/Auction.js';
import Bid from '../models/Bid.js';
import Registration from '../models/Registration.js';
import Manager from '../models/Manager.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';

const clearBadminton = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB:', MONGO_URI);

    // 1. Find all badminton tournaments — everything else chains off this.
    const tournaments = await Tournament.find({ sport: 'badminton' }).select('_id name').lean();
    const tournamentIds = tournaments.map((t) => t._id);

    if (!tournamentIds.length) {
      console.log('No badminton tournaments found. Checking loose badminton players/scores anyway…');
    } else {
      console.log(`Found ${tournamentIds.length} badminton tournament(s):`);
      tournaments.forEach((t) => console.log(`  - ${t.name} (${t._id})`));
    }

    // 2. Collect dependent IDs before deleting so the chain stays intact.
    const teams = await Team.find({ tournamentId: { $in: tournamentIds } }).select('_id').lean();
    const teamIds = teams.map((t) => t._id);

    const matches = await Match.find({ tournamentId: { $in: tournamentIds } }).select('_id').lean();
    const matchIds = matches.map((m) => m._id);

    const auctions = await Auction.find({ tournamentId: { $in: tournamentIds } }).select('_id').lean();
    const auctionIds = auctions.map((a) => a._id);

    console.log(`Dependencies: ${teamIds.length} teams, ${matchIds.length} matches, ${auctionIds.length} auctions`);

    // 3. Delete in reverse-dependency order.
    const results = {};

    // Bids -> tied to auctions
    results.bids = await Bid.deleteMany({ auctionId: { $in: auctionIds } });

    // Auctions -> tied to badminton tournaments
    results.auctions = await Auction.deleteMany({ tournamentId: { $in: tournamentIds } });

    // LiveScores -> either explicitly sport=badminton, or tied to a badminton match
    results.liveScores = await LiveScore.deleteMany({
      $or: [
        { sport: 'badminton' },
        { matchId: { $in: matchIds } },
      ],
    });

    // Matches
    results.matches = await Match.deleteMany({ tournamentId: { $in: tournamentIds } });

    // Registrations
    results.registrations = await Registration.deleteMany({ tournamentId: { $in: tournamentIds } });

    // Players -> either explicitly sport=badminton, or in a badminton tournament
    results.players = await Player.deleteMany({
      $or: [
        { sport: 'badminton' },
        { tournamentId: { $in: tournamentIds } },
      ],
    });

    // Teams
    results.teams = await Team.deleteMany({ tournamentId: { $in: tournamentIds } });

    // Managers (the legacy Manager collection, not User)
    results.managers = await Manager.deleteMany({ tournamentId: { $in: tournamentIds } });

    // Tournaments last
    results.tournaments = await Tournament.deleteMany({ sport: 'badminton' });

    console.log('\nDeletion summary:');
    Object.entries(results).forEach(([k, v]) => {
      console.log(`  ${k.padEnd(14)} ${v.deletedCount}`);
    });

    console.log('\nBadminton data cleared.');
    process.exit(0);
  } catch (err) {
    console.error('Clear failed:', err);
    process.exit(1);
  }
};

clearBadminton();
