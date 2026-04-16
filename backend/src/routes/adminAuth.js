import { Router } from 'express';
import { adminLogin, adminGetMe, adminRefresh, adminLogout } from '../controllers/adminAuthController.js';
import { loginValidator } from '../validators/auth.js';
import validate from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.post('/login', loginValidator, validate, adminLogin);
router.get('/me', authenticate, adminGetMe);
router.post('/refresh', adminRefresh);
router.post('/logout', authenticate, adminLogout);
export default router;
