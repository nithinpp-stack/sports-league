import 'dotenv/config';
import mongoose from 'mongoose';
import Match from '../src/models/Match.js';
import Team from '../src/models/Team.js';
import LiveScore from '../src/models/LiveScore.js';

/**
 * Usage:
 *   node scripts/inspect-match.js "Team A" "Team B"
 */

const [team1Name, team2Name] = process.argv.slice(2);
if (!team1Name || !team2Name) {
  console.error('Usage: node scripts/inspect-match.js "Team A" "Team B"');
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';
await mongoose.connect(MONGO_URI);

const t1 = await Team.findOne({ name: new RegExp(`^${team1Name}$`, 'i') });
const t2 = await Team.findOne({ name: new RegExp(`^${team2Name}$`, 'i') });
if (!t1 || !t2) { console.error('team(s) not found'); await mongoose.disconnect(); process.exit(1); }

const match = await Match.findOne({
  $or: [
    { team1Id: t1._id, team2Id: t2._id },
    { team1Id: t2._id, team2Id: t1._id },
  ],
}).populate('team1Id team2Id', 'name').lean();

console.log('== MATCH ==');
console.log(JSON.stringify(match, null, 2));

const ls = await LiveScore.findOne({ matchId: match._id }).lean();
console.log('\n== LIVESCORE ==');
console.log(JSON.stringify(ls, null, 2));

await mongoose.disconnect();
