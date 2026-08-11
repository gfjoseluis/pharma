import { Router } from 'express';
import { authRequired, requireRoles, requirePermission } from '../../middlewares/auth';
import { listLogs, readLog, rotateNow } from './controller';

const router = Router();

router.use(authRequired);
router.use(requireRoles('admin', 'tecnico'));
router.use(requirePermission('logs.view'));

router.get('/', listLogs);
router.get('/:filename', readLog);
router.post('/rotate', rotateNow);

export default router;
