import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import { notFound, errorHandler } from './middlewares/errorHandler';

import authRoutes from './modules/auth/routes';
import userRoutes from './modules/users/routes';
import clientRoutes from './modules/clients/routes';
import inventoryRoutes from './modules/inventory/routes';
import purchaseRoutes from './modules/purchases/routes';
import branchRoutes from './modules/branches/routes';
import saleRoutes from './modules/sales/routes';
import paymentRoutes from './modules/payments/routes';
import invoiceRoutes from './modules/invoices/routes';
import reportRoutes from './modules/reports/routes';
import licenseRoutes from './modules/licenses/routes';
import backupRoutes from './modules/backups/routes';
import logRoutes from './modules/logs/routes';

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'farmacia-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/logs', logRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
