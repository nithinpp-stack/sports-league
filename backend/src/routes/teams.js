import { Router } from 'express';
import {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamPlayers,
  getMyTeam,
  assignPlayer,
  removePlayer,
} from '../controllers/teamController.js';
import {
  createTeamValidator,
  updateTeamValidator,
  listTeamsValidator,
} from '../validators/team.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize, permit } from '../middleware/auth.js';

const router = Router();

// Public routes
router.get('/', listTeamsValidator, validate, listTeams);
router.get('/my-team', authenticate, getMyTeam);
router.get('/:id', getTeam);
router.get('/:id/players', getTeamPlayers);

// Protected routes
router.post('/', authenticate, permit('teams.create'), createTeamValidator, validate, createTeam);
router.post('/:id/assign-player', authenticate, permit('players.assign'), assignPlayer);
router.post('/:id/remove-player', authenticate, permit('players.assign'), removePlayer);
router.put('/:id', authenticate, updateTeamValidator, validate, updateTeam);
router.delete('/:id', authenticate, permit('teams.delete'), deleteTeam);

export default router;
