import 'dotenv/config';
import mongoose from 'mongoose';
import LiveScore from '../src/models/LiveScore.js';
import Match from '../src/models/Match.js';
import Player from '../src/models/Player.js';
import Tournament from '../src/models/Tournament.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';
await mongoose.connect(MONGO_URI);
console.log('connected');

const completed = await Match.find({ status: 'completed' }).populate('tournamentId', 'sport');
let touched = 0;
for (const match of completed) {
  const sport = match.tournamentId?.sport;
  if (sport !== 'badminton') continue;
  const liveScore = await LiveScore.findOne({ matchId: match._id });
  if (!liveScore?.badmintonData?.gameHistory?.length) continue;
  const team1Points = liveScore.badmintonData.gameHistory.reduce((s, g) => s + (g.team1Points || 0), 0);
  const team2Points = liveScore.badmintonData.gameHistory.reduce((s, g) => s + (g.team2Points || 0), 0);
  const gw = liveScore.badmintonData.gamesWon;
  const t1Id = String(match.team1Id);
  const t2Id = String(match.team2Id);
  const t1W = (gw && gw.get ? gw.get(t1Id) : gw?.[t1Id]) || 0;
  const t2W = (gw && gw.get ? gw.get(t2Id) : gw?.[t2Id]) || 0;
  const winnerTeamId = t1W > t2W ? t1Id : t2Id;
  const bestRally = Math.max(team1Points, team2Points);

  const update = async (teamId, won, lost, wonMatch) => {
    const players = await Player.find({ teamId });
    for (const p of players) {
      const s = p.badmintonStats || { matches: 0, wins: 0, winRate: 0, pointsWon: 0, pointsLost: 0, bestRally: 0 };
      const m = (s.matches || 0) + 1;
      const w = (s.wins || 0) + (wonMatch ? 1 : 0);
      p.badmintonStats = {
        matches: m,
        wins: w,
        winRate: Math.round((w / m) * 100),
        pointsWon: (s.pointsWon || 0) + won,
        pointsLost: (s.pointsLost || 0) + lost,
        bestRally: Math.max(s.bestRally || 0, bestRally),
      };
      p.markModified('badmintonStats');
      await p.save();
      touched++;
      console.log('updated', p.name, p.badmintonStats);
    }
  };
  await update(t1Id, team1Points, team2Points, winnerTeamId === t1Id);
  await update(t2Id, team2Points, team1Points, winnerTeamId === t2Id);
}
console.log('done, touched', touched);
await mongoose.disconnect();
