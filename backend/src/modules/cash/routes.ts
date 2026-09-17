import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { status, open, close, history, report } from './controller';

const router = Router();

router.use(authRequired);

router.get('/status', requirePermission('cash.view'), status);
router.get('/history', requirePermission('cash.view'), history);
router.get('/report', requirePermission('cash.view'), report);
router.post('/open', requirePermission('cash.open'), open);
router.post('/close', requirePermission('cash.close'), close);

export default router;
