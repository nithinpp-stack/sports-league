import { Router } from 'express';
import {
  listUsers,
  getUser,
  updateUser,
  deactivateUser,
  createScorer,
  createManager,
  createEventManager,
} from '../controllers/userController.js';
import {
  createScorerValidator,
  updateUserValidator,
  listUsersValidator,
} from '../validators/user.js';
import validate from '../middleware/validate.js';
import { authenticate, authorize, permit } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', permit('admins.view'), listUsersValidator, validate, listUsers);
router.get('/:id', getUser);
router.put('/:id', updateUserValidator, validate, updateUser);
router.delete('/:id', permit('admins.view'), deactivateUser);
router.post('/create-scorer', permit('admins.create'), createScorerValidator, validate, createScorer);
router.post('/create-manager', permit('admins.create'), createScorerValidator, validate, createManager);
router.post('/create-event-manager', permit('admins.create'), createScorerValidator, validate, createEventManager);

export default router;
