import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { CheckModule } from '../../middlewares/checkModule';
import { list, create, get, remove, discharge } from './controller';

const router = Router();

router.use(authRequired);

router.get('/', requirePermission('purchases'), list);
router.get('/:id', requirePermission('purchases'), get);
router.post('/', requirePermission('purchases'), CheckModule('INVENTARIO'), create);
router.delete('/:id', requirePermission('purchases'), remove);
// Descargo al SIN: marca la compra con factura como descargada
router.post('/:id/descargo', requirePermission('purchases'), CheckModule('INVENTARIO'), discharge);

export default router;
