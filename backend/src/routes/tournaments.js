import { Router } from 'express';
import {
  listTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  updateStatus,
  getTournamentTeams,
  getTournamentMatches,
  getStandings,
} from '../controllers/tournamentController.js';
import {
  createTournamentValidator,
  updateTournamentValidator,
  updateStatusValidator,
  listTournamentsValidator,
} from '../validators/tournament.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize, optionalAuth, permit } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/', optionalAuth, listTournamentsValidator, validate, listTournaments);
router.get('/:id', getTournament);
router.get('/:id/teams', getTournamentTeams);
router.get('/:id/matches', getTournamentMatches);
router.get('/:id/standings', getStandings);

// Protected admin routes
router.post(
  '/',
  authenticate,
  permit('tournaments.create'),
  createTournamentValidator,
  validate,
  createTournament
);
router.put(
  '/:id',
  authenticate,
  permit('tournaments.edit'),
  updateTournamentValidator,
  validate,
  updateTournament
);
router.delete('/:id', authenticate, permit('tournaments.delete'), deleteTournament);
router.put(
  '/:id/status',
  authenticate,
  permit('tournaments.edit'),
  updateStatusValidator,
  validate,
  updateStatus
);

export default router;
