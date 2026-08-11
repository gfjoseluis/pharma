import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { list, create, update, remove } from './controller';

const router = Router();

router.use(authRequired);

router.get('/', requirePermission('clients'), list);
router.post('/', requirePermission('clients'), create);
router.put('/:id', requirePermission('clients'), update);
router.delete('/:id', requirePermission('clients'), remove);

export default router;
