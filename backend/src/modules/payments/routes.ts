import { Router } from 'express';
import { authRequired, requirePermission } from '../../middlewares/auth';
import { CheckModule } from '../../middlewares/checkModule';
import { qrConfirm, cardConfirm, status } from './controller';

const router = Router();

router.use(authRequired);

router.get('/status/:saleId', requirePermission('pos_qr'), status);
router.post('/qr/confirm', requirePermission('pos_qr'), CheckModule('QR'), qrConfirm);
router.post('/card/confirm', requirePermission('pos_qr'), CheckModule('QR'), cardConfirm);

export default router;
