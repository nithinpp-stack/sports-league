import { Router } from 'express';
import { register, login, refresh, logout, getMe } from '../controllers/authController.js';
import { registerValidator, loginValidator } from '../validators/auth.js';
import validate from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerValidator, validate, register);
router.post('/login', loginValidator, validate, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

export default router;
