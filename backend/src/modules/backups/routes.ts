import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { CheckModule } from '../../middlewares/checkModule';
import { force, status, logs } from './controller';

const router = Router();

router.use(authRequired);

router.get('/status', requirePermission('backups'), CheckModule('BACKUPS'), status);
router.post('/force', requirePermission('backups'), CheckModule('BACKUPS'), force);
router.get('/logs', requirePermission('backups'), logs);

export default router;
