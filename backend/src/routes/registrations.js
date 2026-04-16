import { Router } from 'express';
import { authenticate, authorize, permit } from '../middleware/auth.js';
import { listRegistrations, reviewRegistration } from '../controllers/registrationController.js';

const router = Router();

router.get('/', authenticate, permit('registrations.view'), listRegistrations);
router.put('/:id', authenticate, permit('registrations.manage'), reviewRegistration);

export default router;
