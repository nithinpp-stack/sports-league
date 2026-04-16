import { Router } from 'express';
import {
  listMatches,
  getMatch,
  createMatch,
  updateMatch,
  deleteMatch,
  assignScorer,
  getLiveMatches,
  generateMatches,
} from '../controllers/matchController.js';
import {
  createMatchValidator,
  updateMatchValidator,
  assignScorerValidator,
  listMatchesValidator,
} from '../validators/match.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize, permit } from '../middleware/auth.js';

const router = Router();

// Must be before /:id to avoid param collision
router.get('/live', getLiveMatches);
router.post('/generate', authenticate, permit('matches.create'), generateMatches);

// Public routes
router.get('/', listMatchesValidator, validate, listMatches);
router.get('/:id', getMatch);

// Protected admin routes
router.post(
  '/',
  authenticate,
  permit('matches.create'),
  createMatchValidator,
  validate,
  createMatch
);
router.put(
  '/:id',
  authenticate,
  permit('matches.edit'),
  updateMatchValidator,
  validate,
  updateMatch
);
router.delete('/:id', authenticate, permit('matches.delete'), deleteMatch);
router.put(
  '/:id/assign-scorer',
  authenticate,
  permit('matches.edit'),
  assignScorerValidator,
  validate,
  assignScorer
);

export default router;
