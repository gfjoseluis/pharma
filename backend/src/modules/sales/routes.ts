import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { CheckModule } from '../../middlewares/checkModule';
import { create, recent, list, update, deactivate, annul } from './controller';

const router = Router();

router.use(authRequired);

router.get('/recent', requirePermission('pos'), recent);
router.get('/', requirePermission('pos'), list);
router.post('/', requirePermission('pos'), CheckModule('POS'), create);
router.put('/:id', requirePermission('pos'), update);
router.delete('/:id', requirePermission('pos'), deactivate);
router.post('/:id/anular', requirePermission('pos'), CheckModule('FACTURACION'), annul);

export default router;
