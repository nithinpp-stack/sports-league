/**
 * Backfill migration: Player.events[] for badminton players.
 *
 * Populates Player.events with a sensible default based on the player's age
 * and skill for every existing badminton player that has no events yet.
 *
 * Defaults:
 *   - 'mens_singles' for male shuttlers (we can only infer gender if the admin
 *     has tagged the player — we conservatively give everyone singles).
 *   - Also 'mens_doubles' / 'womens_doubles' / 'mixed_doubles' so existing rosters
 *     remain eligible for every category. Admins can refine from the UI later.
 *
 * Also cleans up cross-sport contamination: clears battingStyle/bowlingStyle on
 * football/badminton players, and strips events[] from cricket/football players
 * (in case anyone wrote directly to the DB).
 *
 * Run with: node src/utils/migrate-player-events.js
 * Safe to re-run; idempotent.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Player from '../models/Player.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';

// Conservative default — every event checked — so no existing badminton player
// is accidentally excluded from matches after this migration. Admins should
// narrow these down per player from the admin UI.
const DEFAULT_BADMINTON_EVENTS = [
  'mens_singles',
  'womens_singles',
  'mens_doubles',
  'womens_doubles',
  'mixed_doubles',
];

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // 1) Backfill events[] on badminton players that don't have it
    const badmintonMissing = await Player.countDocuments({
      sport: 'badminton',
      $or: [{ events: { $exists: false } }, { events: { $size: 0 } }],
    });
    console.log(`Badminton players missing events: ${badmintonMissing}`);

    if (badmintonMissing > 0) {
      const result = await Player.updateMany(
        {
          sport: 'badminton',
          $or: [{ events: { $exists: false } }, { events: { $size: 0 } }],
        },
        { $set: { events: DEFAULT_BADMINTON_EVENTS } }
      );
      console.log(`✓ Backfilled events on ${result.modifiedCount} badminton player(s)`);
    }

    // 2) Strip cricket-only fields from non-cricket players (contamination cleanup)
    const contaminated = await Player.countDocuments({
      sport: { $ne: 'cricket' },
      $or: [
        { battingStyle: { $exists: true, $ne: null } },
        { bowlingStyle: { $exists: true, $ne: null } },
      ],
    });
    if (contaminated > 0) {
      const result = await Player.updateMany(
        { sport: { $ne: 'cricket' } },
        { $unset: { battingStyle: '', bowlingStyle: '' } }
      );
      console.log(`✓ Stripped battingStyle/bowlingStyle from ${result.modifiedCount} non-cricket player(s)`);
    }

    // 3) Strip events[] from non-badminton players
    const eventsOnWrongSport = await Player.countDocuments({
      sport: { $ne: 'badminton' },
      events: { $exists: true, $not: { $size: 0 } },
    });
    if (eventsOnWrongSport > 0) {
      const result = await Player.updateMany(
        { sport: { $ne: 'badminton' } },
        { $unset: { events: '' } }
      );
      console.log(`✓ Stripped events[] from ${result.modifiedCount} non-badminton player(s)`);
    }

    console.log('\n✓ Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('✗ Migration failed:', err);
    process.exit(1);
  }
};

run();
