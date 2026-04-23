import { Router } from 'express';
import { authenticate, authorize, permit } from '../middleware/auth.js';
import {
  getAuction,
  startAuction,
  pauseAuction,
  resumeAuction,
  endAuction,
  resetAuction,
  nextPlayer,
  placeBid,
  sellPlayer,
  markUnsold,
  goingOnceAction,
  goingTwiceAction,
  changeSet,
} from '../controllers/auctionController.js';

const router = Router();

// Public — anyone can view the auction (spectators, audience)
router.get('/:tournamentId', getAuction);
router.post('/:tournamentId/start', authenticate, permit('auctions.manage'), startAuction);
router.post('/:tournamentId/pause', authenticate, permit('auctions.manage'), pauseAuction);
router.post('/:tournamentId/resume', authenticate, permit('auctions.manage'), resumeAuction);
router.post('/:tournamentId/end', authenticate, permit('auctions.manage'), endAuction);
// Reset lets admins wipe a stuck/empty auction doc (e.g. one started before
// any players were added) and start fresh. Destructive but idempotent — gated
// by a confirm in the UI.
router.post('/:tournamentId/reset', authenticate, permit('auctions.manage'), resetAuction);
router.post('/:tournamentId/next-player', authenticate, permit('auctions.manage'), nextPlayer);
// Bidding is done by team managers (User.role === 'manager'), not admins, so we
// use `authorize` on the User role enum instead of `permit` (which is admin-only
// via req.user.type === 'admin' and would 403 every manager).
router.post('/:tournamentId/bid', authenticate, authorize('manager', 'team_owner'), placeBid);
router.post('/:tournamentId/sell', authenticate, permit('auctions.manage'), sellPlayer);
router.post('/:tournamentId/unsold', authenticate, permit('auctions.manage'), markUnsold);
router.post('/:tournamentId/going-once', authenticate, permit('auctions.manage'), goingOnceAction);
router.post('/:tournamentId/going-twice', authenticate, permit('auctions.manage'), goingTwiceAction);
router.post('/:tournamentId/change-set', authenticate, permit('auctions.manage'), changeSet);

export default router;
