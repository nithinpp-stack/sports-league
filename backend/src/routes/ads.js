import { Router } from 'express';
import { authenticate, permit } from '../middleware/auth.js';
import { listAds, createAd, updateAd, deleteAd, getPublicAds } from '../controllers/adController.js';

const router = Router();

router.get('/public', getPublicAds);
router.get('/', authenticate, permit('ads.view'), listAds);
router.post('/', authenticate, permit('ads.create'), createAd);
router.put('/:id', authenticate, permit('ads.edit'), updateAd);
router.delete('/:id', authenticate, permit('ads.delete'), deleteAd);

export default router;
