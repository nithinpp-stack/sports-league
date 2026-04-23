import 'dotenv/config';
import mongoose from 'mongoose';
import Match from '../src/models/Match.js';
import Team from '../src/models/Team.js';

/**
 * Usage:
 *   node set-match-category.js "Team A name" "Team B name" category
 *
 * Example:
 *   node set-match-category.js "Bangalore Smashers" "Hyderabad Hitters" mens_singles
 *
 * Valid categories:
 *   mens_singles, womens_singles, mens_doubles, womens_doubles, mixed_doubles
 */

const [team1Name, team2Name, category] = process.argv.slice(2);
if (!team1Name || !team2Name || !category) {
  console.error('Usage: node set-match-category.js "Team 1" "Team 2" <category>');
  process.exit(1);
}

const VALID = ['mens_singles', 'womens_singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];
if (!VALID.includes(category)) {
  console.error('Invalid category. Choose from:', VALID.join(', '));
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';
await mongoose.connect(MONGO_URI);

const t1 = await Team.findOne({ name: new RegExp(`^${team1Name}$`, 'i') });
const t2 = await Team.findOne({ name: new RegExp(`^${team2Name}$`, 'i') });
if (!t1) { console.error('Team not found:', team1Name); await mongoose.disconnect(); process.exit(1); }
if (!t2) { console.error('Team not found:', team2Name); await mongoose.disconnect(); process.exit(1); }

const match = await Match.findOne({
  $or: [
    { team1Id: t1._id, team2Id: t2._id },
    { team1Id: t2._id, team2Id: t1._id },
  ],
});
if (!match) {
  console.error('No match found between', t1.name, 'and', t2.name);
  await mongoose.disconnect();
  process.exit(1);
}

console.log('Match found:', match._id, `(status: ${match.status})`);
console.log(' previous category:', match.category || '(none)');
match.category = category;
await match.save();
console.log(' new category      :', match.category);

await mongoose.disconnect();
console.log('done');
