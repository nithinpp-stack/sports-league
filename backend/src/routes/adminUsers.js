import { Router } from 'express';
import { listAdmins, createAdmin, toggleAdminStatus } from '../controllers/adminUserController.js';
import { authenticate, permit } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.get('/', permit('admins.view'), listAdmins);
router.post('/', permit('admins.create'), createAdmin);
router.patch('/:id/toggle-status', permit('admins.edit'), toggleAdminStatus);
export default router;
