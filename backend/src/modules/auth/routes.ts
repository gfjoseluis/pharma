import { Router } from 'express';
import { login, me } from './controller';
import { authRequired } from '../../middlewares/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authRequired, me);

export default router;
