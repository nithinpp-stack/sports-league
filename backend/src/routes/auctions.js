import { Router } from 'express';
import { authenticate, authorize, permit } from '../middleware/auth.js';
import {
  getAuction,
  startAuction,
  pauseAuction,
  resumeAuction,
  endAuction,
  nextPlayer,
  placeBid,
  sellPlayer,
  markUnsold,
  goingOnceAction,
  goingTwiceAction,
  changeSet,
} from '../controllers/auctionController.js';

const router = Router();

router.get('/:tournamentId', authenticate, getAuction);
router.post('/:tournamentId/start', authenticate, permit('auctions.manage'), startAuction);
router.post('/:tournamentId/pause', authenticate, permit('auctions.manage'), pauseAuction);
router.post('/:tournamentId/resume', authenticate, permit('auctions.manage'), resumeAuction);
router.post('/:tournamentId/end', authenticate, permit('auctions.manage'), endAuction);
router.post('/:tournamentId/next-player', authenticate, permit('auctions.manage'), nextPlayer);
router.post('/:tournamentId/bid', authenticate, permit('auctions.bid'), placeBid);
router.post('/:tournamentId/sell', authenticate, permit('auctions.manage'), sellPlayer);
router.post('/:tournamentId/unsold', authenticate, permit('auctions.manage'), markUnsold);
router.post('/:tournamentId/going-once', authenticate, permit('auctions.manage'), goingOnceAction);
router.post('/:tournamentId/going-twice', authenticate, permit('auctions.manage'), goingTwiceAction);
router.post('/:tournamentId/change-set', authenticate, permit('auctions.manage'), changeSet);

export default router;
