import { Router } from 'express';
import { authRequired, requirePermission, requireRoles } from '../../middlewares/auth';
import { list, activate, deactivate, seedDefault } from './controller';

const router = Router();

router.use(authRequired);

router.get('/', requirePermission('licenses'), list);
router.post('/activate', requirePermission('licenses'), activate);
router.post('/deactivate', requireRoles('admin'), deactivate);
router.post('/seed', requireRoles('admin'), seedDefault);

export default router;
