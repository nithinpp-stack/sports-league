import 'dotenv/config';
import mongoose from 'mongoose';
import Tournament from '../src/models/Tournament.js';

/**
 * Migrate legacy badminton tournament formats:
 *   Singles / Doubles / Mixed Doubles  →  Knockout
 *
 * Rationale: Singles / Doubles / Mixed Doubles are *match categories*, not
 * tournament formats. BWF tournament formats are Knockout, Round Robin,
 * Group + Knockout, Double Elimination.
 *
 * Usage:
 *   node scripts/migrate-badminton-formats.js
 */

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';
await mongoose.connect(MONGO_URI);

const legacy = ['Singles', 'Doubles', 'Mixed Doubles'];
const tournaments = await Tournament.find({ sport: 'badminton', format: { $in: legacy } });
console.log(`Found ${tournaments.length} badminton tournament(s) on a legacy format.`);

for (const t of tournaments) {
  const prev = t.format;
  t.format = 'Knockout';
  await t.save();
  console.log(` + ${t._id}  "${t.name}"  ${prev} → Knockout`);
}

console.log('Done.');
await mongoose.disconnect();
