// Remove players from every cricket team:
//  - flip each player back to status='available' and strip teamId
//  - reset each cricket team's playerCount to 0 and remainingPoints to totalPoints
// Does NOT delete players or teams. Safe to re-run. Does NOT touch auctions —
// if you also want the auction cleared, run the reset-auction script after.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Tournament from '../src/models/Tournament.js';
import Team from '../src/models/Team.js';
import Player from '../src/models/Player.js';

await mongoose.connect(process.env.MONGODB_URI);

const tournaments = await Tournament.find({ sport: 'cricket' }).select('_id name');
if (!tournaments.length) {
  console.log('No cricket tournaments found.');
  await mongoose.disconnect();
  process.exit(0);
}

console.log(`Found ${tournaments.length} cricket tournament(s):`);
tournaments.forEach((t) => console.log(`  - ${t.name} (${t._id})`));

const tournamentIds = tournaments.map((t) => t._id);

// 1) Unassign every player whose team lives in a cricket tournament. We scope
//    by player.tournamentId (cheaper index hit than joining through teams).
const playerRes = await Player.updateMany(
  { tournamentId: { $in: tournamentIds }, teamId: { $ne: null } },
  { $set: { status: 'available' }, $unset: { teamId: 1 } }
);
console.log(`Players unassigned: ${playerRes.modifiedCount}`);

// 2) Reset each cricket team's squad counters + remaining budget. We loop so
//    remainingPoints lands on whichever of totalPoints / budget / 1000 the
//    seed has been using.
const teams = await Team.find({ tournamentId: { $in: tournamentIds } });
for (const t of teams) {
  t.playerCount = 0;
  t.remainingPoints = t.totalPoints ?? t.budget ?? 1000;
  await t.save();
}
console.log(`Teams reset: ${teams.length}`);

await mongoose.disconnect();
console.log('Done.');
