import { Router } from 'express';
import { authRequired, requirePermission, requireRoles } from '../../middlewares/auth';
import { list, create, update, deactivate, remove } from './controller';

const router = Router();

router.use(authRequired);
router.use(requireRoles('admin', 'tecnico'));

router.get('/', requirePermission('users.view'), list);
router.post('/', requirePermission('users.manage'), create);
router.put('/:id', requirePermission('users.manage'), update);
router.delete('/:id', requirePermission('users.manage'), deactivate);
router.delete('/:id/hard', requireRoles('admin'), remove);

export default router;