import { Router } from 'express';
import {
  listPlayers,
  getPlayer,
  getPlayerStats,
  getPlayerMatches,
  getPlayerAchievements,
  createPlayer,
  updatePlayer,
  registerForTournament,
} from '../controllers/playerController.js';
import {
  createPlayerValidator,
  updatePlayerValidator,
  registerTournamentValidator,
  listPlayersValidator,
} from '../validators/player.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize, permit } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/', listPlayersValidator, validate, listPlayers);
router.get('/:id/stats', getPlayerStats);
router.get('/:id/matches', getPlayerMatches);
router.get('/:id/achievements', getPlayerAchievements);
router.get('/:id', getPlayer);

// Protected routes
router.post('/', authenticate, permit('players.create'), createPlayerValidator, validate, createPlayer);
router.put('/:id', authenticate, updatePlayerValidator, validate, updatePlayer);
router.post(
  '/register-tournament',
  authenticate,
  authorize('player'),
  registerTournamentValidator,
  validate,
  registerForTournament
);

export default router;
