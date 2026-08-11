import { Router } from 'express';
import { authRequired, requirePermission, requireAnyPermission } from '../../middlewares/auth';
import {
  list, create, update, remove,
  stock, movements, distribute, transfer, stockReport,
} from './controller';

const router = Router();

router.use(authRequired);

router.get('/', requirePermission('branches.view'), list);
router.post('/', requirePermission('branches.edit'), create);
router.put('/:id', requirePermission('branches.edit'), update);
router.delete('/:id', requirePermission('branches.edit'), remove);

router.get('/stock', requireAnyPermission('branches.view', 'branches.stock'), stock);
router.get('/stock/report', requireAnyPermission('branches.view', 'branches.stock'), stockReport);
router.get('/movements', requireAnyPermission('branches.view', 'branches.stock'), movements);
router.post('/distribute', requirePermission('branches.stock'), distribute);
router.post('/transfer', requirePermission('branches.stock'), transfer);

export default router;