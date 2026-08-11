import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { force, status, logs } from './controller';

const router = Router();

router.use(authRequired);

router.get('/status', requirePermission('backups.view'), status);
router.post('/force', requirePermission('backups.manage'), force);
router.get('/logs', requirePermission('backups.view'), logs);

export default router;