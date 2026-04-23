// Reset + spread players across tiers so the new startAuction seeds three
// non-empty sets (Marquee / Capped / Uncapped) and auto-advance can be
// demonstrated when a set is exhausted. Usage:
//   node scripts/reset-and-bracket.js <tournamentId>
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Auction from '../src/models/Auction.js';
import Bid from '../src/models/Bid.js';
import Player from '../src/models/Player.js';
import Team from '../src/models/Team.js';

const tournamentId = process.argv[2];
if (!tournamentId) { console.error('Usage: node scripts/reset-and-bracket.js <tournamentId>'); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI);

const auction = await Auction.findOne({ tournamentId });
if (auction) {
  await Bid.deleteMany({ auctionId: auction._id });
  await Auction.deleteOne({ _id: auction._id });
}

// Mark every player available + strip their team.
await Player.updateMany({ tournamentId }, { $set: { status: 'available' }, $unset: { teamId: 1 } });

// Now tier them: first 2 → Marquee (100), next 2 → Capped (50), rest stay
// at their current (low) basePoints so they land in Uncapped. Using small,
// ladder-friendly numbers so the demo is quick.
const players = await Player.find({ tournamentId }).sort({ _id: 1 });
for (let i = 0; i < players.length; i++) {
  const p = players[i];
  if (i < 2) p.basePoints = 100;
  else if (i < 4) p.basePoints = 50;
  else p.basePoints = 10;
  await p.save();
}

const teams = await Team.find({ tournamentId });
for (const t of teams) {
  t.remainingPoints = t.totalPoints ?? t.budget ?? 1000;
  t.playerCount = 0;
  await t.save();
}

const counts = { marquee: players.filter((p, i) => i < 2).length, capped: 2, uncapped: players.length - 4 };
console.log('Reset + re-bracketed:', counts);

await mongoose.disconnect();
