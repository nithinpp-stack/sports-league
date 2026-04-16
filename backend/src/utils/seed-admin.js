import 'dotenv/config';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import Role from '../models/Role.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if already seeded
    const existingAdmin = await Admin.findOne({ email: 'admin@sportsleague.com' });
    if (existingAdmin) {
      console.log('Super admin already exists, skipping seed');
      process.exit(0);
    }

    // Create roles
    const superAdminRole = await Role.findOneAndUpdate(
      { name: 'Super Admin' },
      { name: 'Super Admin', level: 1, status: 'active', permissions: ['*', 'dashboard.access'], isDefault: true },
      { upsert: true, new: true }
    );

    await Role.findOneAndUpdate(
      { name: 'Event Manager' },
      {
        name: 'Event Manager', level: 2, status: 'active', isDefault: true,
        permissions: [
          'dashboard.access',
          'tournaments.view', 'tournaments.create', 'tournaments.edit', 'tournaments.delete',
          'teams.view', 'teams.create', 'teams.edit', 'teams.delete',
          'managers.view', 'managers.create', 'managers.delete',
          'players.view', 'players.create', 'players.edit', 'players.assign',
          'matches.view', 'matches.create', 'matches.edit', 'matches.delete', 'matches.score',
          'auctions.view', 'auctions.manage',
          'admins.view', 'admins.create', 'admins.edit', 'admins.delete',
        ],
      },
      { upsert: true, new: true }
    );

    console.log('Roles created');

    // Create super admin
    await Admin.create({
      name: 'Admin User',
      email: 'admin@sportsleague.com',
      password: 'admin123',
      roleId: superAdminRole._id,
    });

    console.log('Super admin created: admin@sportsleague.com / admin123');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seedAdmin();
