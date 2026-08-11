import { Router } from 'express';
import { authRequired, requirePermission, requireAnyPermission } from '../../middlewares/auth';
import { list, create, update, remove } from './controller';

const router = Router();

router.use(authRequired);

router.get('/', requirePermission('clients.view'), list);
router.post('/', requireAnyPermission('clients.create', 'pos.sale'), create);
router.put('/:id', requirePermission('clients.edit'), update);
router.delete('/:id', requirePermission('clients.delete'), remove);

export default router;