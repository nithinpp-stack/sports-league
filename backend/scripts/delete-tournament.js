import 'dotenv/config';
import mongoose from 'mongoose';
import Tournament from '../src/models/Tournament.js';
import Team from '../src/models/Team.js';
import Match from '../src/models/Match.js';
import LiveScore from '../src/models/LiveScore.js';
import Player from '../src/models/Player.js';
import Registration from '../src/models/Registration.js';

const TOURNAMENT_ID = process.argv[2];
if (!TOURNAMENT_ID) {
  console.error('Usage: node delete-tournament.js <tournamentId>');
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';
await mongoose.connect(MONGO_URI);

const t = await Tournament.findById(TOURNAMENT_ID);
if (!t) {
  console.log('Tournament not found:', TOURNAMENT_ID);
  await mongoose.disconnect();
  process.exit(0);
}
console.log('Deleting tournament:', t.name, `(${t._id})`);

const matches = await Match.find({ tournamentId: TOURNAMENT_ID }).select('_id');
const matchIds = matches.map((m) => m._id);
console.log(' matches:', matchIds.length);

const ls = await LiveScore.deleteMany({ matchId: { $in: matchIds } });
console.log(' livescores removed:', ls.deletedCount);

const m = await Match.deleteMany({ tournamentId: TOURNAMENT_ID });
console.log(' matches removed:', m.deletedCount);

const p = await Player.deleteMany({ tournamentId: TOURNAMENT_ID });
console.log(' players removed:', p.deletedCount);

const tm = await Team.deleteMany({ tournamentId: TOURNAMENT_ID });
console.log(' teams removed:', tm.deletedCount);

let regRemoved = 0;
try {
  const r = await Registration.deleteMany({ tournamentId: TOURNAMENT_ID });
  regRemoved = r.deletedCount;
} catch (e) {
  console.warn(' registrations collection skipped:', e.message);
}
console.log(' registrations removed:', regRemoved);

await Tournament.deleteOne({ _id: TOURNAMENT_ID });
console.log(' tournament doc removed');

await mongoose.disconnect();
console.log('done');
