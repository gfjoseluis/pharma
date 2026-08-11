import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { create, recent, list, update, deactivate, annul } from './controller';

const router = Router();

router.use(authRequired);

router.get('/recent', requirePermission('sales.view'), recent);
router.get('/', requirePermission('sales.view'), list);
router.post('/', requirePermission('pos.sale'), create);
router.put('/:id', requirePermission('sales.view'), update);
router.delete('/:id', requirePermission('sales.delete'), deactivate);
router.post('/:id/anular', requirePermission('sales.annul'), annul);

export default router;