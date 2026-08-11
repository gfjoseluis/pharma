import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { list, create, get, remove } from './controller';

const router = Router();

router.use(authRequired);

router.get('/', requirePermission('purchases.view'), list);
router.get('/:id', requirePermission('purchases.view'), get);
router.post('/', requirePermission('purchases.create'), create);
router.delete('/:id', requirePermission('purchases.delete'), remove);

export default router;