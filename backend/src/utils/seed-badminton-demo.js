/**
 * Demo seed: four local badminton tournaments — one per BWF-compliant format —
 * each with its own clubs (teams), shuttlers (players), and a handful of matches.
 *
 * Running twice is safe: the script deletes any prior entities tagged with
 * the marker `demo: true` on the tournament.description JSON sidecar, then
 * re-seeds from scratch.
 *
 * Run:  node src/utils/seed-badminton-demo.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Player from '../models/Player.js';
import Match from '../models/Match.js';
import LiveScore from '../models/LiveScore.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sports-league';

// ── Source data ──────────────────────────────────────────────────────────────

const TOURNAMENTS = [
  {
    name: 'Spring Knockout Championship',
    format: 'Knockout',
    venue: 'National Indoor Arena, Birmingham',
    location: 'Birmingham, UK',
    description: 'Single-elimination knockout cup. One loss and you\'re out.',
    teamCount: 4, // clean bracket
  },
  {
    name: 'BWF All-Stars Round Robin',
    format: 'Round Robin',
    venue: 'Istora Senayan, Jakarta',
    location: 'Jakarta, Indonesia',
    description: 'Every team plays every other team — league format.',
    teamCount: 4,
  },
  {
    name: 'Summer Group Slam',
    format: 'Group + Knockout',
    venue: 'Odense Sports Park',
    location: 'Odense, Denmark',
    description: 'Two groups of three feeding a knockout final round.',
    teamCount: 6,
  },
  {
    name: 'Pro Circuit Double Elimination',
    format: 'Double Elimination',
    venue: 'Axiata Arena, Kuala Lumpur',
    location: 'Kuala Lumpur, Malaysia',
    description: 'Lose once and drop to the losers\' bracket — lose twice, you\'re out.',
    teamCount: 4,
  },
];

// Club names — we'll pick from these in order.
const CLUB_POOL = [
  'Shuttle Smash Club',
  'Feather Dynamos',
  'Net Rippers',
  'Drop-Shot Warriors',
  'Ace Volley Academy',
  'Baseline Bandits',
  'Skyline Shuttlers',
  'Thunder Racquets',
];

// Male + Female first names to mix doubles rosters.
const MALE_FIRST = ['Aaron', 'Viktor', 'Lee', 'Kento', 'Chou', 'Anthony', 'Jonatan', 'Anders'];
const FEMALE_FIRST = ['Tai', 'Akane', 'Carolina', 'Nozomi', 'Chen', 'Pornpawee', 'An', 'Ratchanok'];
const LAST = ['Chen', 'Axelsen', 'Chong', 'Momota', 'Tien', 'Ginting', 'Christie', 'Antonsen', 'Tzu', 'Yamaguchi', 'Marín', 'Okuhara', 'Yufei', 'Chochuwong', 'Se', 'Intanon'];

// Deterministic "pick N" helpers so re-runs are reproducible.
let rngSeed = 1;
const rand = () => {
  // Mulberry32 — tiny deterministic PRNG
  rngSeed |= 0; rngSeed = (rngSeed + 0x6D2B79F5) | 0;
  let t = Math.imul(rngSeed ^ (rngSeed >>> 15), 1 | rngSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => rand() - 0.5);

const BADMINTON_EVENTS = ['mens_singles', 'womens_singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];
const eventsForPlayer = (gender) => {
  // Everyone gets singles for their gender + doubles + mixed — admins can narrow later.
  if (gender === 'M') return ['mens_singles', 'mens_doubles', 'mixed_doubles'];
  return ['womens_singles', 'womens_doubles', 'mixed_doubles'];
};

const playersForTeam = (teamIdx) => {
  // 8-strong squad: 4 men, 4 women. Enough to field every BWF category.
  const out = [];
  for (let i = 0; i < 4; i++) {
    out.push({
      name: `${MALE_FIRST[(teamIdx * 3 + i) % MALE_FIRST.length]} ${LAST[(teamIdx * 5 + i) % LAST.length]}`,
      gender: 'M',
      age: 22 + ((teamIdx + i) % 10),
    });
  }
  for (let i = 0; i < 4; i++) {
    out.push({
      name: `${FEMALE_FIRST[(teamIdx * 3 + i + 1) % FEMALE_FIRST.length]} ${LAST[(teamIdx * 7 + i + 2) % LAST.length]}`,
      gender: 'F',
      age: 21 + ((teamIdx + i) % 9),
    });
  }
  return out;
};

// ── Main ─────────────────────────────────────────────────────────────────────

const run = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const admin = await Admin.findOne({ email: 'admin@sportsleague.com' });
    if (!admin) throw new Error('Run seed-admin.js first — no super admin found.');

    // 1. Clean any previous demo data (idempotent re-run)
    const existing = await Tournament.find({
      name: { $in: TOURNAMENTS.map((t) => t.name) },
      sport: 'badminton',
    }).select('_id');
    const existingIds = existing.map((t) => t._id);
    if (existingIds.length) {
      await Promise.all([
        Player.deleteMany({ tournamentId: { $in: existingIds } }),
        Team.deleteMany({ tournamentId: { $in: existingIds } }),
        Match.deleteMany({ tournamentId: { $in: existingIds } }).then(async (res) => {
          // Also clear the related LiveScore docs
          // (we could key on matchId — but since matches are gone, just sweep orphans)
          await LiveScore.deleteMany({ matchId: { $nin: (await Match.find({}).select('_id')).map((m) => m._id) } });
          return res;
        }),
        Tournament.deleteMany({ _id: { $in: existingIds } }),
      ]);
      console.log(`✓ Removed ${existingIds.length} existing demo tournament(s) + children`);
    }

    const now = new Date();
    const daysFromNow = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

    for (let tIdx = 0; tIdx < TOURNAMENTS.length; tIdx++) {
      const cfg = TOURNAMENTS[tIdx];
      rngSeed = 1000 + tIdx; // reset per-tournament for reproducibility

      // -- Tournament --------------------------------------------------------
      // All demo tournaments are wrapped up — each has a declared champion (see
      // standings). Start dates are in the past, end dates end today, status is
      // 'completed'.
      const tournament = await Tournament.create({
        name: cfg.name,
        sport: 'badminton',
        format: cfg.format,
        venue: cfg.venue,
        location: cfg.location,
        description: cfg.description,
        startDate: daysFromNow(-(20 - tIdx * 2)),
        endDate: daysFromNow(-(10 - tIdx * 2)),
        status: 'completed',
        maxTeams: cfg.teamCount,
        createdBy: admin._id,
      });
      console.log(`\n── ${tournament.name} (${tournament.format}) ───────────────`);

      // -- Teams -------------------------------------------------------------
      const teamDocs = [];
      for (let i = 0; i < cfg.teamCount; i++) {
        const clubName = `${CLUB_POOL[(tIdx * 2 + i) % CLUB_POOL.length]} — ${tournament.venue.split(',')[0].trim()}`;
        teamDocs.push({
          name: clubName,
          tournamentId: tournament._id,
          maxPlayers: 8,
        });
      }
      const teams = await Team.insertMany(teamDocs);
      console.log(`✓ Created ${teams.length} team(s)`);

      // -- Players -----------------------------------------------------------
      const allPlayerDocs = [];
      const teamPlayerIds = new Map(); // teamId -> [{id, gender}]
      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        const roster = playersForTeam(i + tIdx * 10);
        const docs = roster.map((p) => ({
          name: p.name,
          sport: 'badminton',
          skill: 'shuttler',
          age: p.age,
          events: eventsForPlayer(p.gender),
          teamId: team._id,
          tournamentId: tournament._id,
          basePoints: 50 + Math.floor(rand() * 100),
          status: 'sold',
        }));
        const saved = await Player.insertMany(docs);
        teamPlayerIds.set(
          String(team._id),
          saved.map((s, idx) => ({ id: s._id, gender: roster[idx].gender }))
        );
        allPlayerDocs.push(...saved);
        // Update playerCount on the team
        await Team.updateOne({ _id: team._id }, { playerCount: saved.length });
      }
      console.log(`✓ Created ${allPlayerDocs.length} player(s)`);

      // -- Matches -----------------------------------------------------------
      // Every tournament gets the same mix:
      //   * 1 completed match (with a result + game scores)
      //   * 1 live match (with in-progress badmintonData)
      //   * remaining = upcoming
      // Format-specific structure:
      //   * Round Robin → every pair
      //   * Knockout → pairs in halves (shuffled)
      //   * Group + Knockout → group-stage pairs per group
      //   * Double Elimination → same as knockout for seed purposes
      const shuffled = shuffle(teams);

      const pairings = [];
      if (cfg.format === 'Round Robin') {
        for (let i = 0; i < shuffled.length; i++) {
          for (let j = i + 1; j < shuffled.length; j++) {
            pairings.push([shuffled[i], shuffled[j]]);
          }
        }
      } else if (cfg.format === 'Group + Knockout') {
        // Two groups of three for the 6-team case
        const groupA = shuffled.slice(0, 3);
        const groupB = shuffled.slice(3);
        for (const g of [groupA, groupB]) {
          for (let i = 0; i < g.length; i++) {
            for (let j = i + 1; j < g.length; j++) {
              pairings.push([g[i], g[j]]);
            }
          }
        }
      } else {
        // Knockout / Double Elimination → pair adjacent
        for (let i = 0; i < shuffled.length - 1; i += 2) {
          pairings.push([shuffled[i], shuffled[i + 1]]);
        }
      }

      // Pick a category per match — rotate through events so every category appears.
      const CATEGORIES = ['mens_singles', 'womens_singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles'];
      const playersNeeded = (cat) => (cat.endsWith('_singles') ? 1 : 2);
      const genderForCat = (cat, side) => {
        if (cat === 'mixed_doubles') return side === 0 ? 'M' : 'F';
        if (cat.startsWith('mens')) return 'M';
        return 'F';
      };
      const pickCourtPlayers = (teamId, cat) => {
        const need = playersNeeded(cat);
        const roster = teamPlayerIds.get(String(teamId)) || [];
        if (cat === 'mixed_doubles') {
          // One M + one F
          const male = roster.find((r) => r.gender === 'M');
          const female = roster.find((r) => r.gender === 'F');
          return [male?.id, female?.id].filter(Boolean);
        }
        const genderFilter = cat.startsWith('mens') ? 'M' : 'F';
        return roster.filter((r) => r.gender === genderFilter).slice(0, need).map((r) => r.id);
      };

      // The champion is the first team in the shuffled order — they win every
      // match they play in, so standings put them on top unambiguously.
      const championTeam = shuffled[0];
      // Runner-up: beats everyone except the champion. Makes standings look real.
      const runnerUpTeam = shuffled[1];

      // Deterministic winner picker for a pairing.
      const pickWinner = (a, b) => {
        const ids = [String(a._id), String(b._id)];
        const champId = String(championTeam._id);
        const runId = String(runnerUpTeam._id);
        if (ids.includes(champId)) return String(a._id) === champId ? a : b;
        if (ids.includes(runId)) return String(a._id) === runId ? a : b;
        // Otherwise — team with smaller ObjectId string wins (deterministic).
        return String(a._id) < String(b._id) ? a : b;
      };

      // Realistic BWF scorelines. Champion and runner-up dominate; others are tighter.
      const buildScoreline = (winner, loser, isDominantWin) => {
        // isDominantWin → 2-0 in straight games; otherwise 2-1 thriller.
        let games;
        if (isDominantWin) {
          games = [
            { gameNumber: 1, winnerPts: 21, loserPts: 15 + Math.floor(rand() * 5) },
            { gameNumber: 2, winnerPts: 21, loserPts: 14 + Math.floor(rand() * 6) },
          ];
        } else {
          // 2-1 thriller — loser wins game 1 or 2
          const loserGame = rand() < 0.5 ? 1 : 2;
          games = [1, 2, 3].map((g) => {
            if (g === loserGame) return { gameNumber: g, winnerPts: 18 + Math.floor(rand() * 3), loserPts: 21, loserWinsThis: true };
            if (g === 3) return { gameNumber: g, winnerPts: 21, loserPts: 17 + Math.floor(rand() * 4) };
            return { gameNumber: g, winnerPts: 21, loserPts: 15 + Math.floor(rand() * 5) };
          });
        }
        const winnerGamesCount = games.filter((g) => !g.loserWinsThis).length;
        const loserGamesCount = games.length - winnerGamesCount;
        // Score strings shown from the winner's perspective, e.g. "21-15, 14-21, 21-19"
        const scoreStrings = games.map((g) =>
          g.loserWinsThis ? `${g.loserPts}-${g.winnerPts}` : `${g.winnerPts}-${g.loserPts}`
        );
        return {
          scores: games,
          summary: (winnerName, loserName) =>
            `${winnerName} beat ${loserName} ${winnerGamesCount}-${loserGamesCount} (${scoreStrings.join(', ')})`,
        };
      };

      const createdMatches = [];
      for (let pIdx = 0; pIdx < pairings.length; pIdx++) {
        const [t1, t2] = pairings[pIdx];
        const cat = CATEGORIES[pIdx % CATEGORIES.length];
        const t1OnCourt = pickCourtPlayers(t1._id, cat);
        const t2OnCourt = pickCourtPlayers(t2._id, cat);

        // Space completed matches back through the tournament window so the
        // timeline looks like a real bracket.
        const matchDate = daysFromNow(-(15 - tIdx * 2) + Math.floor(pIdx / 2));

        const winner = pickWinner(t1, t2);
        const loser = winner._id.equals(t1._id) ? t2 : t1;
        // Champion and runner-up win dominantly; other matches are closer
        const isChampInvolved = [String(t1._id), String(t2._id)].includes(String(championTeam._id));
        const scoreline = buildScoreline(winner, loser, isChampInvolved);

        // Shape scores[] in the team1/team2 order the schema expects
        const scoresForSchema = scoreline.scores.map((g) => {
          const winnerIsT1 = winner._id.equals(t1._id);
          const t1Pts = g.loserWinsThis ? (winnerIsT1 ? g.loserPts : g.winnerPts) : (winnerIsT1 ? g.winnerPts : g.loserPts);
          const t2Pts = g.loserWinsThis ? (winnerIsT1 ? g.winnerPts : g.loserPts) : (winnerIsT1 ? g.loserPts : g.winnerPts);
          const gameWinnerId = g.loserWinsThis ? loser._id : winner._id;
          return { gameNumber: g.gameNumber, team1Points: t1Pts, team2Points: t2Pts, winner: gameWinnerId };
        });

        const gamesWon = scoresForSchema.filter((s) => String(s.winner) === String(winner._id)).length;
        const gamesLost = scoresForSchema.length - gamesWon;

        const match = await Match.create({
          tournamentId: tournament._id,
          team1Id: t1._id,
          team2Id: t2._id,
          date: matchDate,
          venue: tournament.venue,
          status: 'completed',
          category: cat,
          team1Players: t1OnCourt,
          team2Players: t2OnCourt,
          result: {
            winner: winner._id,
            winType: 'points',
            winMargin: gamesWon - gamesLost,
            summary: scoreline.summary(winner.name, loser.name),
            scores: scoresForSchema,
          },
        });
        createdMatches.push({ match, winnerId: winner._id });
      }

      const champWins = createdMatches.filter((m) => String(m.winnerId) === String(championTeam._id)).length;
      console.log(`✓ Created ${createdMatches.length} completed match(es) — champion: ${championTeam.name} (${champWins} wins)`);

      // -- Per-player badminton stats ---------------------------------------
      // Walk completed matches, aggregate per-player {matches, wins, pointsWon,
      // pointsLost, bestRally}. Without this, the Rankings tab filters everyone
      // out (computeRankingRow requires matches > 0).
      const statsByPlayer = new Map(); // playerId -> stats obj
      const bumpStats = (pid, { won, ptsFor, ptsAgainst, rally }) => {
        const key = String(pid);
        const cur = statsByPlayer.get(key) || {
          matches: 0, wins: 0, pointsWon: 0, pointsLost: 0, bestRally: 0,
        };
        cur.matches += 1;
        if (won) cur.wins += 1;
        cur.pointsWon += ptsFor;
        cur.pointsLost += ptsAgainst;
        if (rally > cur.bestRally) cur.bestRally = rally;
        statsByPlayer.set(key, cur);
      };

      for (const { match, winnerId } of createdMatches) {
        const scores = match.result?.scores || [];
        const t1Total = scores.reduce((n, s) => n + (s.team1Points || 0), 0);
        const t2Total = scores.reduce((n, s) => n + (s.team2Points || 0), 0);
        const t1Rally = Math.max(0, ...scores.map((s) => s.team1Points || 0));
        const t2Rally = Math.max(0, ...scores.map((s) => s.team2Points || 0));
        const t1Won = String(winnerId) === String(match.team1Id);
        const t2Won = String(winnerId) === String(match.team2Id);

        for (const pid of match.team1Players || []) {
          bumpStats(pid, { won: t1Won, ptsFor: t1Total, ptsAgainst: t2Total, rally: t1Rally });
        }
        for (const pid of match.team2Players || []) {
          bumpStats(pid, { won: t2Won, ptsFor: t2Total, ptsAgainst: t1Total, rally: t2Rally });
        }
      }

      if (statsByPlayer.size > 0) {
        const ops = [...statsByPlayer.entries()].map(([pid, s]) => ({
          updateOne: {
            filter: { _id: pid },
            update: {
              $set: {
                badmintonStats: {
                  matches: s.matches,
                  wins: s.wins,
                  winRate: s.matches > 0 ? parseFloat((s.wins / s.matches).toFixed(3)) : 0,
                  pointsWon: s.pointsWon,
                  pointsLost: s.pointsLost,
                  bestRally: s.bestRally,
                },
              },
            },
          },
        }));
        await Player.bulkWrite(ops);
        console.log(`✓ Populated badmintonStats on ${statsByPlayer.size} player(s)`);
      }
    }

    console.log('\n────────────────────────────────────────');
    console.log('All four demo tournaments seeded.');
    console.log('Public app: http://localhost:3000/tournaments');
    console.log('────────────────────────────────────────');
    process.exit(0);
  } catch (err) {
    console.error('✗ Seed failed:', err);
    process.exit(1);
  }
};

run();
