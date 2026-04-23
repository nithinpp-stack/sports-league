// Post-cleanup sanity check: assert every badminton-scoped collection is empty.
import 'dotenv/config';
import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Player from '../models/Player.js';
import Match from '../models/Match.js';
import LiveScore from '../models/LiveScore.js';
import Auction from '../models/Auction.js';
import Bid from '../models/Bid.js';
import Registration from '../models/Registration.js';
import Manager from '../models/Manager.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';

(async () => {
  await mongoose.connect(MONGO_URI);
  const tournaments = await Tournament.countDocuments({ sport: 'badminton' });
  const players = await Player.countDocuments({ sport: 'badminton' });
  const liveScores = await LiveScore.countDocuments({ sport: 'badminton' });

  // Also confirm no dangling refs: teams/matches/auctions/etc that point at
  // a tournamentId whose tournament no longer exists AND is badminton-shaped.
  // (Simpler proxy: just count rows referencing any now-nonexistent tournament.)
  const orphanTeams = await Team.countDocuments({ tournamentId: { $nin: (await Tournament.find().select('_id').lean()).map(t => t._id) } });
  const orphanMatches = await Match.countDocuments({ tournamentId: { $nin: (await Tournament.find().select('_id').lean()).map(t => t._id) } });
  const orphanAuctions = await Auction.countDocuments({ tournamentId: { $nin: (await Tournament.find().select('_id').lean()).map(t => t._id) } });
  const orphanRegistrations = await Registration.countDocuments({ tournamentId: { $nin: (await Tournament.find().select('_id').lean()).map(t => t._id) } });
  const orphanManagers = await Manager.countDocuments({ tournamentId: { $nin: (await Tournament.find().select('_id').lean()).map(t => t._id) } });

  // Totals per collection for context
  const totals = {
    tournaments_total: await Tournament.countDocuments(),
    teams_total: await Team.countDocuments(),
    players_total: await Player.countDocuments(),
    matches_total: await Match.countDocuments(),
    auctions_total: await Auction.countDocuments(),
    bids_total: await Bid.countDocuments(),
    liveScores_total: await LiveScore.countDocuments(),
    registrations_total: await Registration.countDocuments(),
    managers_total: await Manager.countDocuments(),
  };

  console.log('Badminton residue:');
  console.log('  tournaments(sport=badminton):', tournaments);
  console.log('  players(sport=badminton):   ', players);
  console.log('  liveScores(sport=badminton):', liveScores);
  console.log('\nOrphan rows (referencing a deleted tournamentId):');
  console.log('  teams:        ', orphanTeams);
  console.log('  matches:      ', orphanMatches);
  console.log('  auctions:     ', orphanAuctions);
  console.log('  registrations:', orphanRegistrations);
  console.log('  managers:     ', orphanManagers);
  console.log('\nCollection totals after cleanup:');
  Object.entries(totals).forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${v}`));

  process.exit(0);
})();
