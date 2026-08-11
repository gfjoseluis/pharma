import { Router } from 'express';
import { authRequired, requirePermission, requireAnyPermission } from '../../middlewares/auth';
import {
  listCategories, createCategory, updateCategory, deactivateCategory,
  listLaboratories, createLaboratory, updateLaboratory, deactivateLaboratory,
  listUnits, createUnit, updateUnit, deactivateUnit,
  listForms, createForm, updateForm, deactivateForm,
  listSuppliers, createSupplier, updateSupplier, deactivateSupplier,
  listProducts, searchProducts, getProduct, createProduct, updateProduct, deactivateProduct,
  productStock, expiringStock,
} from './controller';

const router = Router();

router.use(authRequired);

// ---- Categorias ----
router.get('/categories', requirePermission('inventory.refs.view'), listCategories);
router.post('/categories', requirePermission('inventory.refs.manage'), createCategory);
router.put('/categories/:id', requirePermission('inventory.refs.manage'), updateCategory);
router.delete('/categories/:id', requirePermission('inventory.refs.manage'), deactivateCategory);

// ---- Laboratorios ----
router.get('/laboratories', requirePermission('inventory.refs.view'), listLaboratories);
router.post('/laboratories', requirePermission('inventory.refs.manage'), createLaboratory);
router.put('/laboratories/:id', requirePermission('inventory.refs.manage'), updateLaboratory);
router.delete('/laboratories/:id', requirePermission('inventory.refs.manage'), deactivateLaboratory);

// ---- Unidades de medida ----
router.get('/units', requirePermission('inventory.refs.view'), listUnits);
router.post('/units', requirePermission('inventory.refs.manage'), createUnit);
router.put('/units/:id', requirePermission('inventory.refs.manage'), updateUnit);
router.delete('/units/:id', requirePermission('inventory.refs.manage'), deactivateUnit);

// ---- Formas farmaceuticas ----
router.get('/forms', requireAnyPermission('forms.manage', 'inventory.refs.view'), listForms);
router.post('/forms', requirePermission('forms.manage'), createForm);
router.put('/forms/:id', requirePermission('forms.manage'), updateForm);
router.delete('/forms/:id', requirePermission('forms.manage'), deactivateForm);

// ---- Proveedores ----
router.get('/suppliers', requireAnyPermission('inventory.refs.view', 'purchases.view'), listSuppliers);
router.post('/suppliers', requirePermission('inventory.refs.manage'), createSupplier);
router.put('/suppliers/:id', requirePermission('inventory.refs.manage'), updateSupplier);
router.delete('/suppliers/:id', requirePermission('inventory.refs.manage'), deactivateSupplier);

// ---- Productos ----
router.get('/products', requirePermission('products.view'), listProducts);
// El buscador lo usa el POS (cajero) y las compras (inventario)
router.get('/products/search', requireAnyPermission('pos.sale', 'products.view'), searchProducts);
router.get('/products/:id', requirePermission('products.view'), getProduct);
router.get('/products/:id/stock', requirePermission('products.view'), productStock);
router.post('/products', requirePermission('products.create'), createProduct);
router.put('/products/:id', requirePermission('products.edit'), updateProduct);
router.delete('/products/:id', requirePermission('products.delete'), deactivateProduct);

// Lotes por vencer (campana de notificaciones)
router.get('/expiring', requireAnyPermission('products.view', 'pos.view', 'branches.view', 'purchases.view'), expiringStock);

export default router;