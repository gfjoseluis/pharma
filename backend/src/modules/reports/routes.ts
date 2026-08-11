import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { salesReport, inventoryReport, sinReport, exportCsv } from './controller';

const router = Router();

router.use(authRequired);

router.get('/sales', requirePermission('reports.view'), salesReport);
router.get('/inventory', requirePermission('reports.view'), inventoryReport);
router.get('/sin', requirePermission('reports.view'), sinReport);
router.get('/export', requirePermission('reports.view'), exportCsv);

export default router;
