// Create/upsert a User with role='manager' and wire it to Mumbai Warriors so
// we can demo the team-side bidding flow. Running this twice is safe — it
// finds the existing user by email and just re-attaches the team.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../src/models/User.js';
import Team from '../src/models/Team.js';

await mongoose.connect(process.env.MONGODB_URI);

const email = 'mumbai@bid.test';
const name = 'Mumbai Bidder';
const password = 'bidder123';

// Always delete-and-recreate so the pre-save hash runs cleanly (previous
// version of this script pre-hashed, which double-hashed via the pre-save
// hook and broke login).
await User.deleteOne({ email });
const user = await User.create({ name, email, password, role: 'manager' });
console.log('Created user', user._id.toString());

const team = await Team.findOne({ name: 'Mumbai Warriors' });
if (!team) {
  console.error('Mumbai Warriors team not found');
  process.exit(1);
}
team.managerId = user._id;
await team.save();
console.log('Linked Mumbai Warriors → user', user._id.toString());

console.log('\nLogin credentials:');
console.log('  email:   ', email);
console.log('  password:', password);

await mongoose.disconnect();
