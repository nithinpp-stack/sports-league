import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';
import Player from '../models/Player.js';
import LiveScore from '../models/LiveScore.js';

export const listTournaments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.sport) filter.sport = req.query.sport;
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }
    // Scope tournaments for non-super-admin users
    if (req.user?.type === 'admin') {
      const Admin = (await import('../models/Admin.js')).default;
      const admin = await Admin.findById(req.user.id).populate('roleId');
      const perms = [...(admin?.roleId?.permissions || []), ...(admin?.permissions || [])];
      if (!perms.includes('*')) {
        filter.createdBy = req.user.id;
      }
    }

    const [tournaments, total] = await Promise.all([
      Tournament.find(filter)
        .populate('createdBy', 'name email')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Tournament.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { tournaments },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const getTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate('createdBy', 'name email');
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    return res.json({ success: true, data: { tournament } });
  } catch (err) {
    next(err);
  }
};

export const createTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.create({
      ...req.body,
      createdBy: req.user.id,
    });
    return res.status(201).json({ success: true, data: { tournament } });
  } catch (err) {
    next(err);
  }
};

export const updateTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    const hasWildcard = req.adminRole?.permissions?.includes('*');
    if (!hasWildcard && tournament.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only manage your own tournaments' });
    }
    const updated = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    return res.json({ success: true, data: { tournament: updated } });
  } catch (err) {
    next(err);
  }
};

export const deleteTournament = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    const hasWildcard = req.adminRole?.permissions?.includes('*');
    if (!hasWildcard && tournament.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only manage your own tournaments' });
    }
    if (tournament.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft tournaments can be deleted',
      });
    }
    await tournament.deleteOne();
    return res.json({ success: true, data: { message: 'Tournament deleted' } });
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    const hasWildcard = req.adminRole?.permissions?.includes('*');
    if (!hasWildcard && tournament.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You can only manage your own tournaments' });
    }
    const updated = await Tournament.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    return res.json({ success: true, data: { tournament: updated } });
  } catch (err) {
    next(err);
  }
};

export const getTournamentTeams = async (req, res, next) => {
  try {
    const teams = await Team.find({ tournamentId: req.params.id }).populate('managerId', 'name email');
    return res.json({ success: true, data: { teams } });
  } catch (err) {
    next(err);
  }
};

export const getTournamentMatches = async (req, res, next) => {
  try {
    const matches = await Match.find({ tournamentId: req.params.id })
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo')
      .sort({ date: 1 });
    return res.json({ success: true, data: { matches } });
  } catch (err) {
    next(err);
  }
};

export const getStandings = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const sport = tournament.sport || 'cricket';

    const teams = await Team.find({ tournamentId: req.params.id }).select('name logo');
    const matches = await Match.find({
      tournamentId: req.params.id,
      status: 'completed',
    })
      .populate('team1Id', 'name logo')
      .populate('team2Id', 'name logo');

    const standingsMap = {};
    const makeRow = (team) => {
      if (sport === 'football') {
        return { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
      }
      if (sport === 'badminton') {
        // BWF-style: matches W/L + game diff + point diff. No "tie" or "no result" — badminton always has a winner.
        return { team, played: 0, won: 0, lost: 0, gamesFor: 0, gamesAgainst: 0, gameDiff: 0, pointsFor: 0, pointsAgainst: 0, pointDiff: 0, points: 0 };
      }
      // cricket default (keeps tie/no-result semantics — valid for cricket)
      return { team, played: 0, won: 0, lost: 0, noResult: 0, points: 0 };
    };

    for (const team of teams) {
      standingsMap[team._id.toString()] = makeRow(team);
    }

    // Pre-load livescores for badminton so we can aggregate game/point diffs in one query
    let liveScoreByMatch = {};
    if (sport === 'badminton' && matches.length) {
      const matchIds = matches.map((m) => m._id);
      const scores = await LiveScore.find({ matchId: { $in: matchIds } }).lean();
      liveScoreByMatch = scores.reduce((acc, s) => {
        acc[s.matchId.toString()] = s;
        return acc;
      }, {});
    }

    for (const match of matches) {
      const t1 = match.team1Id?._id?.toString();
      const t2 = match.team2Id?._id?.toString();
      if (!t1 || !t2) continue;

      if (!standingsMap[t1]) standingsMap[t1] = makeRow(match.team1Id);
      if (!standingsMap[t2]) standingsMap[t2] = makeRow(match.team2Id);

      standingsMap[t1].played += 1;
      standingsMap[t2].played += 1;

      const winnerId = match.result?.winner?.toString();
      const winType = match.result?.winType;

      if (sport === 'football') {
        const homeGoals = match.result?.homeGoals ?? 0;
        const awayGoals = match.result?.awayGoals ?? 0;

        standingsMap[t1].goalsFor += homeGoals;
        standingsMap[t1].goalsAgainst += awayGoals;
        standingsMap[t2].goalsFor += awayGoals;
        standingsMap[t2].goalsAgainst += homeGoals;

        if (winType === 'draw' || (!winnerId && winType !== 'no_result')) {
          standingsMap[t1].drawn += 1;
          standingsMap[t2].drawn += 1;
          standingsMap[t1].points += 1;
          standingsMap[t2].points += 1;
        } else if (winnerId === t1) {
          standingsMap[t1].won += 1;
          standingsMap[t2].lost += 1;
          standingsMap[t1].points += 3;
        } else if (winnerId === t2) {
          standingsMap[t2].won += 1;
          standingsMap[t1].lost += 1;
          standingsMap[t2].points += 3;
        }

        standingsMap[t1].goalDifference = standingsMap[t1].goalsFor - standingsMap[t1].goalsAgainst;
        standingsMap[t2].goalDifference = standingsMap[t2].goalsFor - standingsMap[t2].goalsAgainst;
      } else if (sport === 'badminton') {
        // Aggregate games + points. Completed matches carry their scores on
        // match.result.scores (authoritative); live matches keep them on
        // LiveScore.badmintonData.gameHistory. Prefer the former when present.
        const ls = liveScoreByMatch[match._id.toString()];
        const resultScores = Array.isArray(match.result?.scores) ? match.result.scores : null;
        const history = resultScores && resultScores.length > 0
          ? resultScores
          : (ls?.badmintonData?.gameHistory || []);
        let t1Games = 0;
        let t2Games = 0;
        let t1Points = 0;
        let t2Points = 0;
        for (const g of history) {
          const gp1 = g.team1Points || 0;
          const gp2 = g.team2Points || 0;
          t1Points += gp1;
          t2Points += gp2;
          if (g.winner && g.winner.toString() === t1) t1Games += 1;
          else if (g.winner && g.winner.toString() === t2) t2Games += 1;
          else if (gp1 > gp2) t1Games += 1;
          else if (gp2 > gp1) t2Games += 1;
        }

        standingsMap[t1].gamesFor += t1Games;
        standingsMap[t1].gamesAgainst += t2Games;
        standingsMap[t2].gamesFor += t2Games;
        standingsMap[t2].gamesAgainst += t1Games;
        standingsMap[t1].pointsFor += t1Points;
        standingsMap[t1].pointsAgainst += t2Points;
        standingsMap[t2].pointsFor += t2Points;
        standingsMap[t2].pointsAgainst += t1Points;

        if (winnerId === t1) {
          standingsMap[t1].won += 1;
          standingsMap[t2].lost += 1;
          standingsMap[t1].points += 1; // BWF round-robin: 1 pt per match win
        } else if (winnerId === t2) {
          standingsMap[t2].won += 1;
          standingsMap[t1].lost += 1;
          standingsMap[t2].points += 1;
        }

        standingsMap[t1].gameDiff = standingsMap[t1].gamesFor - standingsMap[t1].gamesAgainst;
        standingsMap[t2].gameDiff = standingsMap[t2].gamesFor - standingsMap[t2].gamesAgainst;
        standingsMap[t1].pointDiff = standingsMap[t1].pointsFor - standingsMap[t1].pointsAgainst;
        standingsMap[t2].pointDiff = standingsMap[t2].pointsFor - standingsMap[t2].pointsAgainst;
      } else {
        // cricket
        if (winType === 'no_result') {
          standingsMap[t1].noResult += 1;
          standingsMap[t2].noResult += 1;
          standingsMap[t1].points += 1;
          standingsMap[t2].points += 1;
        } else if (winnerId === t1) {
          standingsMap[t1].won += 1;
          standingsMap[t2].lost += 1;
          standingsMap[t1].points += 2;
        } else if (winnerId === t2) {
          standingsMap[t2].won += 1;
          standingsMap[t1].lost += 1;
          standingsMap[t2].points += 2;
        } else if (winType === 'tie') {
          standingsMap[t1].noResult += 1;
          standingsMap[t2].noResult += 1;
          standingsMap[t1].points += 1;
          standingsMap[t2].points += 1;
        }
      }
    }

    let standings;
    if (sport === 'football') {
      standings = Object.values(standingsMap).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.goalDifference - a.goalDifference;
      });
    } else if (sport === 'badminton') {
      // BWF tiebreakers: matches won desc → game diff desc → point diff desc
      standings = Object.values(standingsMap).sort((a, b) => {
        if (b.won !== a.won) return b.won - a.won;
        if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
        return b.pointDiff - a.pointDiff;
      });
    } else {
      standings = Object.values(standingsMap).sort((a, b) => b.points - a.points);
    }

    return res.json({ success: true, data: { standings, sport } });
  } catch (err) {
    next(err);
  }
};

// ─── BWF-inspired finishing-position points ─────────────────────────────────
//
// Modelled on the official BWF World Ranking System, which awards points by how
// far a player progresses in a tournament (Winner → Runner-up → Semi-final …),
// NOT by cumulative rally points. Scale chosen for amateur / local leagues —
// a full BWF Super-1000 winner takes 13,500 points; we compress the curve so the
// same shape (big gap between champion and runner-up, diminishing returns down
// the bracket) is preserved at a friendlier magnitude.
//
// Reference: https://en.wikipedia.org/wiki/BWF_World_Ranking
const BWF_FINISH_POINTS = {
  winner: 1000,
  runnerUp: 700,
  semiFinal: 450,
  quarterFinal: 250,
  r16: 120,
  r32: 50,
  participated: 10, // played at least one match but ranked 33+ (or group-stage out)
};

const FINISH_LABELS = {
  winner: 'Winner',
  runnerUp: 'Runner-up',
  semiFinal: 'Semi-final',
  quarterFinal: 'Quarter-final',
  r16: 'Round of 16',
  r32: 'Round of 32',
  participated: 'Participated',
};

// Per-player involvement bonuses on top of team finish points — so an active
// shuttler who won every rubber still ranks above a bench player on the same
// team. BWF doesn't do this (their points are purely bracket-position), but we
// need it because multiple players share a team's finish here.
const PER_WIN_BONUS = 50;
const PER_MATCH_BONUS = 10;

const finishKeyForRank = (rank, totalTeams) => {
  if (rank === 1) return 'winner';
  if (rank === 2) return 'runnerUp';
  if (rank <= 4) return 'semiFinal';
  if (rank <= 8) return 'quarterFinal';
  if (rank <= 16) return 'r16';
  if (rank <= 32) return 'r32';
  return 'participated';
};

// Per-sport points formula. Each returns { points, displayStats } for a player.
// Badminton is handled separately (it needs tournament-wide context for finish
// position), so this function only handles cricket and football.
const computeRankingRow = (player, sport) => {
  if (sport === 'football') {
    const s = player.footballStats || {};
    const goals = s.goals || 0;
    const assists = s.assists || 0;
    const cleanSheets = s.cleanSheets || 0;
    const yellow = s.yellowCards || 0;
    const red = s.redCards || 0;
    const matches = s.matches || 0;
    const points = goals * 4 + assists * 2 + cleanSheets * 4 - yellow - red * 3;
    return {
      points,
      matches,
      stats: { goals, assists, cleanSheets, yellowCards: yellow, redCards: red },
    };
  }
  // cricket (default)
  const s = player.stats || {};
  const runs = s.runs || 0;
  const wickets = s.wickets || 0;
  const catches = s.catches || 0;
  const matches = s.matches || 0;
  const points = runs + wickets * 20 + catches * 5;
  return {
    points,
    matches,
    stats: { runs, wickets, catches, highestScore: s.highestScore || 0, bestBowling: s.bestBowling || '0/0' },
  };
};

// Compute each team's final ranking from completed matches. Works for
// knockout, round-robin, group + knockout, and double-elimination — all of
// them converge on "team with the most wins finishes highest". Ties are broken
// by game-differential then rally-point-differential (same BWF tiebreakers as
// the standings endpoint).
const computeTeamFinishes = (matches, teams) => {
  const table = {};
  for (const t of teams) {
    table[String(t._id)] = { teamId: String(t._id), wins: 0, losses: 0, gameDiff: 0, pointDiff: 0 };
  }
  for (const m of matches) {
    if (m.status !== 'completed' || !m.result?.winner) continue;
    const t1 = String(m.team1Id);
    const t2 = String(m.team2Id);
    const winner = String(m.result.winner);
    if (!table[t1] || !table[t2]) continue;

    const scores = Array.isArray(m.result.scores) ? m.result.scores : [];
    let t1Games = 0, t2Games = 0, t1Pts = 0, t2Pts = 0;
    for (const s of scores) {
      t1Pts += s.team1Points || 0;
      t2Pts += s.team2Points || 0;
      if (String(s.winner) === t1) t1Games += 1;
      else if (String(s.winner) === t2) t2Games += 1;
    }
    table[t1].gameDiff += (t1Games - t2Games);
    table[t2].gameDiff += (t2Games - t1Games);
    table[t1].pointDiff += (t1Pts - t2Pts);
    table[t2].pointDiff += (t2Pts - t1Pts);

    if (winner === t1) { table[t1].wins += 1; table[t2].losses += 1; }
    else if (winner === t2) { table[t2].wins += 1; table[t1].losses += 1; }
  }

  const sorted = Object.values(table).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    return b.pointDiff - a.pointDiff;
  });

  const total = sorted.length;
  const byTeam = {};
  sorted.forEach((row, idx) => {
    const rank = idx + 1;
    const finishKey = finishKeyForRank(rank, total);
    byTeam[row.teamId] = {
      rank,
      finishKey,
      finishLabel: FINISH_LABELS[finishKey],
      finishPoints: BWF_FINISH_POINTS[finishKey],
      teamWins: row.wins,
      teamLosses: row.losses,
    };
  });
  return byTeam;
};

export const getRankings = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    const sport = tournament.sport || 'cricket';

    // Players can enter a tournament via two paths:
    //   a) Direct registration → Player.tournamentId is set
    //   b) Assigned to a Team via /teams/:id/assign-player → only Player.teamId is set
    // We must accept both or path-b players (typical for team-based badminton /
    // cricket tournaments) disappear from rankings entirely. Gather the team IDs
    // scoped to this tournament and match players on either signal.
    const tournamentTeamIds = (
      await Team.find({ tournamentId: req.params.id }).select('_id').lean()
    ).map((t) => t._id);

    const players = await Player.find({
      $or: [
        { tournamentId: req.params.id },
        { teamId: { $in: tournamentTeamIds } },
      ],
    })
      .populate('teamId', 'name logo')
      .lean();

    // ─── Badminton: BWF-style (finish position drives ranking points) ──────
    if (sport === 'badminton') {
      const [matches, teams] = await Promise.all([
        Match.find({ tournamentId: req.params.id })
          .select('team1Id team2Id status result')
          .lean(),
        Team.find({ tournamentId: req.params.id }).select('_id name logo').lean(),
      ]);

      const finishByTeam = computeTeamFinishes(matches, teams);

      const rankings = players
        .map((p) => {
          const s = p.badmintonStats || {};
          const matchesPlayed = s.matches || 0;
          const wins = s.wins || 0;
          const pointsWon = s.pointsWon || 0;
          const pointsLost = s.pointsLost || 0;
          const winRate = s.winRate || 0;
          const teamId = p.teamId?._id ? String(p.teamId._id) : null;
          const finish = teamId ? finishByTeam[teamId] : null;
          const finishPts = finish?.finishPoints || 0;
          // Ranking points = team finish pts + per-player involvement bonuses
          const points = finishPts + wins * PER_WIN_BONUS + matchesPlayed * PER_MATCH_BONUS;

          return {
            player: {
              _id: p._id,
              name: p.name,
              photo: p.photo,
              skill: p.skill,
            },
            team: p.teamId
              ? { _id: p.teamId._id, name: p.teamId.name, logo: p.teamId.logo }
              : null,
            matches: matchesPlayed,
            points,
            finish: finish
              ? { key: finish.finishKey, label: finish.finishLabel, rank: finish.rank, points: finishPts }
              : null,
            stats: {
              wins,
              losses: Math.max(0, matchesPlayed - wins),
              pointsWon,
              pointsLost,
              pointDiff: pointsWon - pointsLost,
              // badmintonStats.winRate is already stored as a percent (0-100)
              // by the live-scoring controller, so no further scaling needed.
              winRate: Math.round(winRate || 0),
            },
          };
        })
        .filter((r) => r.matches > 0)
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.stats.wins !== a.stats.wins) return b.stats.wins - a.stats.wins;
          return b.stats.pointDiff - a.stats.pointDiff;
        })
        .map((r, idx) => ({ rank: idx + 1, ...r }));

      return res.json({
        success: true,
        data: {
          rankings,
          sport,
          scheme: {
            name: 'BWF-inspired',
            finishPoints: BWF_FINISH_POINTS,
            perWinBonus: PER_WIN_BONUS,
            perMatchBonus: PER_MATCH_BONUS,
          },
        },
      });
    }

    // ─── Cricket / football fall back to the legacy cumulative-stats model ──
    const rankings = players
      .map((p) => {
        const row = computeRankingRow(p, sport);
        return {
          player: {
            _id: p._id,
            name: p.name,
            photo: p.photo,
            skill: p.skill,
          },
          team: p.teamId
            ? { _id: p.teamId._id, name: p.teamId.name, logo: p.teamId.logo }
            : null,
          matches: row.matches,
          points: row.points,
          stats: row.stats,
        };
      })
      .filter((r) => r.matches > 0)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.matches - a.matches;
      })
      .map((r, idx) => ({ rank: idx + 1, ...r }));

    return res.json({ success: true, data: { rankings, sport } });
  } catch (err) {
    next(err);
  }
};

// ─── Knockout bracket ──────────────────────────────────────────────────────
//
// The Match schema has no explicit `round` field, so we derive rounds from the
// match count + team count and chronological order:
//
//   - R (total rounds) = ceil(log2(T))   where T = participating teams
//   - "Full bracket" slots = 2^R; byes = slots − T
//   - Round 1 has (2^(R-1) − byes) matches; every subsequent round has half of
//     the previous round (normal single-elim progression).
//
// We then slice the date-sorted match list into those bucket sizes. This
// assumes matches are scheduled in round order — a safe assumption for a
// bracket tournament where R2 can't be played before R1 resolves.
//
// For T < 2 (no opponents yet), returns an empty rounds array so the UI can
// show an empty-state card.

const knockoutRoundLabel = (roundNum, totalRounds) => {
  const fromEnd = totalRounds - roundNum;
  switch (fromEnd) {
    case 0: return 'Final';
    case 1: return 'Semi-finals';
    case 2: return 'Quarter-finals';
    case 3: return 'Round of 16';
    case 4: return 'Round of 32';
    default: return `Round ${roundNum}`;
  }
};

const buildKnockoutBracket = (teams, matches) => {
  const T = teams.length;
  if (T < 2 || matches.length === 0) {
    return { rounds: [], totalTeams: T, totalRounds: 0 };
  }

  const totalRounds = Math.max(1, Math.ceil(Math.log2(T)));
  const fullBracketSlots = Math.pow(2, totalRounds);
  const byes = fullBracketSlots - T;
  const firstRoundSize = Math.max(0, Math.pow(2, totalRounds - 1) - byes);

  const roundSizes = [];
  for (let k = 1; k <= totalRounds; k++) {
    if (k === 1) roundSizes.push(firstRoundSize || Math.pow(2, totalRounds - 1));
    else roundSizes.push(Math.pow(2, totalRounds - k));
  }

  const sorted = [...matches].sort(
    (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
  );

  const rounds = [];
  let offset = 0;
  for (let k = 0; k < totalRounds; k++) {
    const size = roundSizes[k];
    if (size <= 0) continue;
    const slice = sorted.slice(offset, offset + size);
    offset += size;
    rounds.push({
      round: k + 1,
      label: knockoutRoundLabel(k + 1, totalRounds),
      matches: slice.map((m) => ({
        _id: m._id,
        date: m.date,
        status: m.status,
        venue: m.venue,
        category: m.category,
        team1: m.team1Id
          ? { _id: m.team1Id._id, name: m.team1Id.name, logo: m.team1Id.logo }
          : null,
        team2: m.team2Id
          ? { _id: m.team2Id._id, name: m.team2Id.name, logo: m.team2Id.logo }
          : null,
        result: m.result
          ? {
              winner: m.result.winner || null,
              summary: m.result.summary,
              scores: Array.isArray(m.result.scores) ? m.result.scores : [],
            }
          : null,
      })),
    });
  }

  // Trailing matches past what the formula predicted (happens if admin scheduled
  // a 3rd-place playoff or something odd). Park them in a catch-all "Extra" round.
  if (offset < sorted.length) {
    rounds.push({
      round: rounds.length + 1,
      label: 'Other matches',
      matches: sorted.slice(offset).map((m) => ({
        _id: m._id,
        date: m.date,
        status: m.status,
        venue: m.venue,
        category: m.category,
        team1: m.team1Id
          ? { _id: m.team1Id._id, name: m.team1Id.name, logo: m.team1Id.logo }
          : null,
        team2: m.team2Id
          ? { _id: m.team2Id._id, name: m.team2Id.name, logo: m.team2Id.logo }
          : null,
        result: m.result
          ? {
              winner: m.result.winner || null,
              summary: m.result.summary,
              scores: Array.isArray(m.result.scores) ? m.result.scores : [],
            }
          : null,
      })),
    });
  }

  return { rounds, totalTeams: T, totalRounds, byes };
};

export const getBracket = async (req, res, next) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const [teams, matches] = await Promise.all([
      Team.find({ tournamentId: req.params.id }).select('_id name logo').lean(),
      Match.find({ tournamentId: req.params.id })
        .populate('team1Id', 'name logo')
        .populate('team2Id', 'name logo')
        .lean(),
    ]);

    const bracket = buildKnockoutBracket(teams, matches);

    return res.json({
      success: true,
      data: {
        ...bracket,
        format: tournament.format,
        sport: tournament.sport || 'cricket',
      },
    });
  } catch (err) {
    next(err);
  }
};
