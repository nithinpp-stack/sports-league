import 'dotenv/config';
import mongoose from 'mongoose';
import Match from '../src/models/Match.js';
import LiveScore from '../src/models/LiveScore.js';
import Tournament from '../src/models/Tournament.js';

/**
 * Backfill match.result.scores for completed badminton matches by
 * copying gameHistory out of the corresponding LiveScore document.
 *
 * Usage:
 *   node scripts/backfill-match-scores.js
 */

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';
await mongoose.connect(MONGO_URI);

// Find badminton tournaments
const badmintonTournaments = await Tournament.find({ sport: 'badminton' }).select('_id name').lean();
const tIds = badmintonTournaments.map((t) => t._id);
console.log(`Found ${badmintonTournaments.length} badminton tournaments`);

const matches = await Match.find({
  tournamentId: { $in: tIds },
  status: 'completed',
});
console.log(`Found ${matches.length} completed badminton matches`);

let updated = 0;
for (const m of matches) {
  if (m.result?.scores && m.result.scores.length) continue; // already has scores

  const ls = await LiveScore.findOne({ matchId: m._id }).lean();
  const history = ls?.badmintonData?.gameHistory || [];
  if (!history.length) {
    console.log(` - skip ${m._id}: no gameHistory`);
    continue;
  }

  m.result = {
    ...(m.result?.toObject ? m.result.toObject() : m.result || {}),
    scores: history.map((g) => ({
      gameNumber: g.gameNumber,
      team1Points: g.team1Points,
      team2Points: g.team2Points,
      winner: g.winner,
    })),
  };
  m.markModified('result');
  await m.save();
  updated += 1;
  console.log(` + updated ${m._id} with ${history.length} game scores`);
}

console.log(`Done. Updated ${updated} match(es).`);
await mongoose.disconnect();
