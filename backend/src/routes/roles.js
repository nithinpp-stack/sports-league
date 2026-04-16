import { Router } from 'express';
import { listRoles, getRole, createRole, updateRole, deleteRole, getPermissionSchema } from '../controllers/roleController.js';
import { authenticate, permit } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.get('/permissions', permit('roles.view'), getPermissionSchema);
router.get('/', permit('roles.view'), listRoles);
router.get('/:id', permit('roles.view'), getRole);
router.post('/', permit('roles.create'), createRole);
router.put('/:id', permit('roles.edit'), updateRole);
router.delete('/:id', permit('roles.delete'), deleteRole);
export default router;
