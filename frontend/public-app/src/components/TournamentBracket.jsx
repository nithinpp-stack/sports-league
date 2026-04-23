import React from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

/**
 * Renders a knockout-style tournament bracket as a horizontally-scrolling
 * series of round columns (R1 → QF → SF → Final), with connecting rails
 * between rounds. Designed primarily for badminton knockout / single-elim
 * formats but format-agnostic — works for any bracket tournament.
 *
 * Props:
 *   rounds     : [{ round, label, matches: [{ _id, team1, team2, result, status, date, category }] }]
 *   totalTeams : number
 *   loading    : boolean
 *
 * Visual rules:
 *   - winner's team name is emerald + bold, loser's is muted
 *   - completed matches show per-game scores (e.g. 21-14, 18-21, 21-17)
 *   - "TBD" placeholder for unscheduled teams
 *   - final column is visually celebrated with a trophy accent
 */
export default function TournamentBracket({ rounds = [], totalTeams = 0, loading = false }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 dark:text-gray-500 text-sm">
        Loading bracket…
      </div>
    );
  }

  if (!rounds || rounds.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-8 text-center">
        <div className="text-4xl mb-2">🏸</div>
        <h3 className="text-slate-900 dark:text-white font-semibold mb-1">Bracket not ready yet</h3>
        <p className="text-slate-500 dark:text-gray-400 text-sm">
          {totalTeams < 2
            ? 'Add at least two teams and schedule matches to see the bracket.'
            : 'Matches haven\u2019t been scheduled for this tournament yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm overflow-x-auto">
      <div className="flex items-start gap-6 sm:gap-10 min-w-max pb-2">
        {rounds.map((round, roundIdx) => {
          const isFinal = roundIdx === rounds.length - 1 && round.label === 'Final';
          // Space matches apart vertically so they visually line up with the
          // midpoint of their pair in the previous round (classic bracket look).
          // Earlier rounds = tight spacing; later rounds = more gap between
          // matches so the rails converge smoothly. Inline style (not Tailwind
          // classes) because JIT won't compile arithmetic into class names.
          const rowGap = 24 + roundIdx * 32;
          return (
            <div key={round.round} className="flex flex-col min-w-[240px] sm:min-w-[260px]">
              <div className="flex items-center gap-2 mb-3">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${
                  isFinal ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {isFinal && <span className="mr-1">🏆</span>}
                  {round.label}
                </h3>
                <span className="text-[11px] font-medium text-slate-400 dark:text-gray-500">
                  ({round.matches.length})
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-gray-700/60" />
              </div>
              <div style={{ rowGap: `${rowGap}px`, display: 'flex', flexDirection: 'column' }}>
                {round.matches.map((match) => (
                  <BracketMatchCard key={match._id} match={match} isFinal={isFinal} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatchCard({ match, isFinal }) {
  const winnerId = match.result?.winner ? String(match.result.winner._id || match.result.winner) : null;
  const t1Id = match.team1 ? String(match.team1._id) : null;
  const t2Id = match.team2 ? String(match.team2._id) : null;
  const isCompleted = match.status === 'completed';
  const t1IsWinner = isCompleted && winnerId === t1Id;
  const t2IsWinner = isCompleted && winnerId === t2Id;
  const scores = Array.isArray(match.result?.scores) ? match.result.scores : [];

  // Winners-highlight: use emerald background for winner, muted for loser.
  const rowClass = (isWinner) =>
    `flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${
      isWinner
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 font-semibold'
        : isCompleted
        ? 'text-slate-500 dark:text-gray-500'
        : 'text-slate-900 dark:text-white'
    }`;

  const gameScoreFor = (gameIdx, teamSlot) => {
    const game = scores[gameIdx];
    if (!game) return null;
    return teamSlot === 1 ? game.team1Points : game.team2Points;
  };

  const matchDate = match.date ? dayjs(match.date) : null;

  return (
    <Link
      to={`/matches/${match._id}`}
      className={`block bg-white dark:bg-gray-900 border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md ${
        isFinal
          ? 'border-amber-300 dark:border-amber-700/60 hover:border-amber-400 dark:hover:border-amber-500'
          : 'border-slate-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700'
      }`}
    >
      {/* Team 1 row */}
      <div className={rowClass(t1IsWinner)}>
        <span className="truncate flex items-center gap-1.5 min-w-0">
          {t1IsWinner && <span className="text-[10px]">▸</span>}
          {match.team1?.name || <span className="italic text-slate-400 dark:text-gray-500">TBD</span>}
        </span>
        {isCompleted && scores.length > 0 && (
          <span className="flex items-center gap-1 shrink-0 font-mono tabular-nums text-xs">
            {scores.map((_, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded ${
                  t1IsWinner ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-gray-800'
                }`}
              >
                {gameScoreFor(i, 1)}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="h-px bg-slate-100 dark:bg-gray-700/60" />

      {/* Team 2 row */}
      <div className={rowClass(t2IsWinner)}>
        <span className="truncate flex items-center gap-1.5 min-w-0">
          {t2IsWinner && <span className="text-[10px]">▸</span>}
          {match.team2?.name || <span className="italic text-slate-400 dark:text-gray-500">TBD</span>}
        </span>
        {isCompleted && scores.length > 0 && (
          <span className="flex items-center gap-1 shrink-0 font-mono tabular-nums text-xs">
            {scores.map((_, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded ${
                  t2IsWinner ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-gray-800'
                }`}
              >
                {gameScoreFor(i, 2)}
              </span>
            ))}
          </span>
        )}
      </div>

      {/* Meta footer: date / status / category */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wide font-medium bg-slate-50 dark:bg-gray-800/60 border-t border-slate-100 dark:border-gray-700/60">
        <span className="text-slate-400 dark:text-gray-500 truncate">
          {matchDate ? matchDate.format('DD MMM, HH:mm') : 'TBD'}
        </span>
        <span className={`shrink-0 ${
          match.status === 'live'
            ? 'text-red-500 dark:text-red-400'
            : match.status === 'completed'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-400 dark:text-gray-500'
        }`}>
          {match.status === 'live' ? '● LIVE' : match.status}
        </span>
      </div>
    </Link>
  );
}
