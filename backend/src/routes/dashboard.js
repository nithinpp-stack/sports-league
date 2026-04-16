import { Router } from 'express';
import { authenticate, authorize, permit } from '../middleware/auth.js';
import { getAdminStats, getRecentActivity, getTeamDashboard } from '../controllers/dashboardController.js';

const router = Router();

router.get('/admin/stats', authenticate, permit('dashboard.access'), getAdminStats);
router.get('/admin/recent-activity', authenticate, permit('dashboard.access'), getRecentActivity);
router.get('/team/:teamId', authenticate, permit('dashboard.access'), getTeamDashboard);

export default router;
