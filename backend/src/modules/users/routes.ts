import { Router } from 'express';
import { authRequired, requirePermission, requireRoles } from '../../middlewares/auth';
import { list, create, update, deactivate, remove } from './controller';

const router = Router();

router.use(authRequired);
router.use(requireRoles('admin', 'tecnico'));

router.get('/', requirePermission('users'), list);
router.post('/', requirePermission('users'), create);
router.put('/:id', requirePermission('users'), update);
router.delete('/:id', requirePermission('users'), deactivate);
router.delete('/:id/hard', requireRoles('admin'), remove);

export default router;
