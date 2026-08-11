import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { salesReport, inventoryReport, sinReport, exportCsv } from './controller';

const router = Router();

router.use(authRequired);

router.get('/sales', requirePermission('reports'), salesReport);
router.get('/inventory', requirePermission('reports'), inventoryReport);
router.get('/sin', requirePermission('reports'), sinReport);
router.get('/export', requirePermission('reports'), exportCsv);

export default router;
