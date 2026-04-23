// Create/refresh a manager User for each of the four cricket teams so every
// team can be logged in separately and demo multi-team bidding. Delete-and-
// recreate pattern keeps passwords correctly hashed (single pre-save hook run)
// and makes the script idempotent.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../src/models/User.js';
import Team from '../src/models/Team.js';

await mongoose.connect(process.env.MONGODB_URI);

// Shared password across all four so a demo operator only has to remember one.
// Email prefix maps to the team so it's obvious who you're logging in as.
const password = 'bidder123';
const seeds = [
  { team: 'Mumbai Warriors',   email: 'mumbai@bid.test',     name: 'Mumbai Bidder' },
  { team: 'Delhi Destroyers',  email: 'delhi@bid.test',      name: 'Delhi Bidder' },
  { team: 'Chennai Kings',     email: 'chennai@bid.test',    name: 'Chennai Bidder' },
  { team: 'Bangalore Bears',   email: 'bangalore@bid.test',  name: 'Bangalore Bidder' },
];

console.log('Seeding team-manager users...\n');

for (const { team: teamName, email, name } of seeds) {
  const team = await Team.findOne({ name: teamName });
  if (!team) {
    console.warn(`  ! Team "${teamName}" not found — skipped`);
    continue;
  }

  await User.deleteOne({ email });
  const user = await User.create({ name, email, password, role: 'manager' });
  team.managerId = user._id;
  await team.save();

  console.log(`  ✓ ${teamName.padEnd(20)} → ${email}  (user ${user._id})`);
}

console.log('\nLogin credentials (all share the same password):');
console.log(`  password: ${password}`);
for (const { team, email } of seeds) {
  console.log(`  ${team.padEnd(20)} ${email}`);
}

await mongoose.disconnect();
