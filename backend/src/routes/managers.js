import { Router } from 'express';
import { listManagers, createManager, updateManager, deleteManager } from '../controllers/managerController.js';
import { authenticate, permit } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.get('/', permit('managers.view'), listManagers);
router.post('/', permit('managers.create'), createManager);
router.put('/:id', permit('managers.create'), updateManager);
router.delete('/:id', permit('managers.delete'), deleteManager);
export default router;
