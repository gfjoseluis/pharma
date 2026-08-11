import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import {
  list, create, update, remove,
  stock, movements, distribute, transfer, stockReport,
} from './controller';

const router = Router();

router.use(authRequired);

router.get('/', list);
router.post('/', requirePermission('branches'), create);
router.put('/:id', requirePermission('branches'), update);
router.delete('/:id', requirePermission('branches'), remove);

router.get('/stock', requirePermission('inventory'), stock);
router.get('/stock/report', requirePermission('inventory'), stockReport);
router.get('/movements', requirePermission('inventory'), movements);
router.post('/distribute', requirePermission('branches'), distribute);
router.post('/transfer', requirePermission('branches'), transfer);

export default router;
