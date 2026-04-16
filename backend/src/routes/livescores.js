import { Router } from 'express';
import { authenticate, authorize, permit } from '../middleware/auth.js';
import {
  getLiveScore,
  getScorecard,
  startMatch,
  recordBall,
  endInnings,
  endMatch,
  reopenMatch,
  undoLastBall,
  recordFootballEvent,
  undoFootballEvent,
} from '../controllers/liveScoreController.js';

const router = Router();

router.get('/:matchId', getLiveScore);
router.get('/:matchId/scorecard', getScorecard);
router.post('/:matchId/start', authenticate, permit('matches.score'), startMatch);
router.post('/:matchId/ball', authenticate, permit('matches.score'), recordBall);
router.post('/:matchId/end-innings', authenticate, permit('matches.score'), endInnings);
router.post('/:matchId/end-match', authenticate, permit('matches.score'), endMatch);
router.post('/:matchId/reopen', authenticate, permit('matches.score'), reopenMatch);
router.post('/:matchId/undo', authenticate, permit('matches.score'), undoLastBall);
router.post('/:matchId/football-event', authenticate, permit('matches.score'), recordFootballEvent);
router.post('/:matchId/football-undo', authenticate, permit('matches.score'), undoFootballEvent);

export default router;
