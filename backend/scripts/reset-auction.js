// One-off reset: drop the auction + re-open all players for the given
// tournament so we can re-run startAuction with the new Phase 1 seeding.
// Also resets each team's playerCount / remainingPoints so the squad stats
// reflect a pre-auction state. Usage: node scripts/reset-auction.js <tournamentId>
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Auction from '../src/models/Auction.js';
import Bid from '../src/models/Bid.js';
import Player from '../src/models/Player.js';
import Team from '../src/models/Team.js';

const tournamentId = process.argv[2];
if (!tournamentId) {
  console.error('Usage: node scripts/reset-auction.js <tournamentId>');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const auction = await Auction.findOne({ tournamentId });
if (auction) {
  await Bid.deleteMany({ auctionId: auction._id });
  await Auction.deleteOne({ _id: auction._id });
  console.log('Deleted auction', auction._id.toString());
}

const playerRes = await Player.updateMany(
  { tournamentId },
  { $set: { status: 'available' }, $unset: { teamId: 1 } }
);
console.log('Players reset:', playerRes.modifiedCount);

const teams = await Team.find({ tournamentId });
for (const t of teams) {
  const total = t.totalPoints ?? t.budget ?? 1000;
  t.remainingPoints = total;
  t.playerCount = 0;
  await t.save();
}
console.log('Teams reset:', teams.length);

await mongoose.disconnect();
console.log('Done.');
