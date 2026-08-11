import { Router } from 'express';
import { authRequired, requirePermission, requireAnyPermission } from '../../middlewares/auth';
import {
  listCategories, createCategory, updateCategory, deactivateCategory,
  listLaboratories, createLaboratory, updateLaboratory, deactivateLaboratory,
  listUnits, createUnit, updateUnit, deactivateUnit,
  listSuppliers, createSupplier, updateSupplier, deactivateSupplier,
  listProducts, searchProducts, getProduct, createProduct, updateProduct, deactivateProduct,
  productStock,
} from './controller';

const router = Router();

router.use(authRequired);

// ---- Categorias ----
router.get('/categories', requirePermission('inventory'), listCategories);
router.post('/categories', requirePermission('inventory'), createCategory);
router.put('/categories/:id', requirePermission('inventory'), updateCategory);
router.delete('/categories/:id', requirePermission('inventory'), deactivateCategory);

// ---- Laboratorios ----
router.get('/laboratories', requirePermission('inventory'), listLaboratories);
router.post('/laboratories', requirePermission('inventory'), createLaboratory);
router.put('/laboratories/:id', requirePermission('inventory'), updateLaboratory);
router.delete('/laboratories/:id', requirePermission('inventory'), deactivateLaboratory);

// ---- Unidades de medida ----
router.get('/units', requirePermission('inventory'), listUnits);
router.post('/units', requirePermission('inventory'), createUnit);
router.put('/units/:id', requirePermission('inventory'), updateUnit);
router.delete('/units/:id', requirePermission('inventory'), deactivateUnit);

// ---- Proveedores ----
router.get('/suppliers', requirePermission('inventory'), listSuppliers);
router.post('/suppliers', requirePermission('inventory'), createSupplier);
router.put('/suppliers/:id', requirePermission('inventory'), updateSupplier);
router.delete('/suppliers/:id', requirePermission('inventory'), deactivateSupplier);

// ---- Productos ----
router.get('/products', requirePermission('inventory'), listProducts);
// El buscador lo usa el POS (cajero) y las compras (inventario)
router.get('/products/search', requireAnyPermission('pos', 'inventory'), searchProducts);
router.get('/products/:id', requirePermission('inventory'), getProduct);
router.get('/products/:id/stock', requirePermission('inventory'), productStock);
router.post('/products', requirePermission('inventory'), createProduct);
router.put('/products/:id', requirePermission('inventory'), updateProduct);
router.delete('/products/:id', requirePermission('inventory'), deactivateProduct);

export default router;
