import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { CheckModule } from '../../middlewares/checkModule';
import { list, issue, annul, print, descargo, report } from './controller';

const router = Router();

router.use(authRequired);

router.get('/', requirePermission('invoices'), CheckModule('FACTURACION'), list);
router.get('/descargo', requirePermission('invoices'), CheckModule('FACTURACION'), descargo);
router.get('/print/:id', requirePermission('invoices'), CheckModule('FACTURACION'), print);
router.post('/', requirePermission('invoices'), CheckModule('FACTURACION'), issue);
router.post('/:id/anular', requirePermission('invoices'), CheckModule('FACTURACION'), annul);
router.get('/reports/sin', requirePermission('invoices'), CheckModule('FACTURACION'), report);

export default router;
