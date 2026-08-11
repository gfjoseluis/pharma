import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { simpleCrud } from './crud';
import { normalizeSku, isValidSkuFormat, generateSku, validateSku } from '../../utils/sku';
import { logAction } from '../../utils/logger';

// ==================== CRUDs simples ====================
export const listCategories = simpleCrud('category').list;
export const createCategory = simpleCrud('category').create;
export const updateCategory = simpleCrud('category').update;
export const deactivateCategory = simpleCrud('category').deactivate;

export const listLaboratories = simpleCrud('laboratory').list;
export const createLaboratory = simpleCrud('laboratory').create;
export const updateLaboratory = simpleCrud('laboratory').update;
export const deactivateLaboratory = simpleCrud('laboratory').deactivate;

export const listUnits = simpleCrud('unitMeasure').list;
export const createUnit = simpleCrud('unitMeasure').create;
export const updateUnit = simpleCrud('unitMeasure').update;
export const deactivateUnit = simpleCrud('unitMeasure').deactivate;

// ==================== Proveedores ====================
export async function listSuppliers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
      include: { products: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    });
    res.json(suppliers);
  } catch (err) { next(err); }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, ruc, phone, email, address, productIds } = req.body || {};
    if (!name) { res.status(400).json({ error: 'name es obligatorio' }); return; }
    if (ruc) {
      const dup = await prisma.supplier.findUnique({ where: { ruc: String(ruc).trim() } });
      if (dup) { res.status(409).json({ error: 'El RUC ya esta registrado' }); return; }
    }
    const supplier = await prisma.supplier.create({
      data: {
        name: String(name).trim(),
        ruc: ruc ? String(ruc).trim() : null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        products: Array.isArray(productIds) && productIds.length
          ? { create: productIds.map((pid: number) => ({ productId: pid })) }
          : undefined,
      },
    });
    logAction('info', `Proveedor creado: ${supplier.name}`, {}, { userId: req.user!.id });
    res.status(201).json(supplier);
  } catch (err) { next(err); }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, ruc, phone, email, address, productIds, active } = req.body || {};
    const supplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          name: name !== undefined ? String(name).trim() : undefined,
          ruc: ruc !== undefined ? (ruc ? String(ruc).trim() : null) : undefined,
          phone: phone !== undefined ? phone : undefined,
          email: email !== undefined ? email : undefined,
          address: address !== undefined ? address : undefined,
          active: active !== undefined ? Boolean(active) : undefined,
        },
      });
      if (Array.isArray(productIds)) {
        await tx.productSupplier.deleteMany({ where: { supplierId: id } });
        if (productIds.length) {
          await tx.productSupplier.createMany({
            data: productIds.map((pid: number) => ({ supplierId: id, productId: pid })),
            skipDuplicates: true,
          });
        }
      }
      return updated;
    });
    res.json(supplier);
  } catch (err) { next(err); }
}

export async function deactivateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.supplier.update({ where: { id }, data: { active: false } });
    logAction('info', `Proveedor desactivado: id ${id}`, {}, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ==================== Productos ====================
const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true } },
  laboratory: { select: { id: true, name: true } },
  unitMeasure: { select: { id: true, name: true, shortName: true } },
  suppliers: { include: { supplier: { select: { id: true, name: true, ruc: true } } } },
  stocks: {
    select: {
      branchId: true,
      quantity: true,
      lot: true,
      expiryDate: true,
      branch: { select: { id: true, name: true } },
    },
  },
};

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = String(req.query.q || '').trim();
    const onlyActive = req.query.active !== 'false';
    const products = await prisma.product.findMany({
      where: {
        ...(q ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }, { barcode: { contains: q } }] } : {}),
        ...(onlyActive ? { active: true } : {}),
      },
      include: PRODUCT_INCLUDE,
      orderBy: { name: 'asc' },
      take: 200,
    });
    res.json(products);
  } catch (err) { next(err); }
}

export async function searchProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = String(req.query.q || '').trim();
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string, 10) : undefined;
    if (q.length < 1) {
      res.json([]);
      return;
    }
    const products = await prisma.product.findMany({
      where: {
        active: true,
        OR: [{ name: { contains: q } }, { sku: { contains: q } }, { barcode: { contains: q } }],
      },
      include: {
        category: { select: { name: true } },
        unitMeasure: { select: { name: true, shortName: true } },
        stocks: {
          select: { branchId: true, quantity: true, lot: true, expiryDate: true, branch: { select: { name: true } } },
        },
      },
      take: 25,
    });
    // Stock en otras sucursales se muestra como consulta, la venta solo usa la propia.
    const result = products.map((p) => {
      const stocks = p.stocks.filter((s) => s.quantity > 0);
      const own = branchId ? stocks.filter((s) => s.branchId === branchId).reduce((a, s) => a + s.quantity, 0) : 0;
      const other = branchId ? stocks.filter((s) => s.branchId !== branchId).reduce((a, s) => a + s.quantity, 0) : 0;
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        barcode: p.barcode,
        presentation: p.presentation,
        price: p.price,
        category: p.category?.name || null,
        unit: p.unitMeasure?.shortName || p.unitMeasure?.name || null,
        stockOwn: own,
        stockOther: other,
        lots: stocks.filter((s) => branchId === undefined || s.branchId === branchId).map((s) => ({
          lot: s.lot,
          expiryDate: s.expiryDate,
          quantity: s.quantity,
          branch: s.branch.name,
        })),
      };
    });
    res.json(result);
  } catch (err) { next(err); }
}

export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const product = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    res.json(product);
  } catch (err) { next(err); }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      sku, autoSku, name, barcode, categoryId, laboratoryId, unitMeasureId,
      presentation, price, costPrice, minStock, supplierIds,
    } = req.body || {};
    if (!name) { res.status(400).json({ error: 'name es obligatorio' }); return; }

    let finalSku: string;
    if (autoSku) {
      finalSku = generateSku();
    } else {
      const { sku: normalized } = validateSku(sku);
      finalSku = normalized;
    }
    const dup = await prisma.product.findUnique({ where: { sku: finalSku } });
    if (dup) {
      res.status(409).json({
        error: `El SKU ${finalSku} ya existe para "${dup.name}". Use otro SKU o active la generacion automatica.`,
        suggestion: generateSku(),
      });
      return;
    }

    const product = await prisma.product.create({
      data: {
        sku: finalSku,
        name: String(name).trim(),
        barcode: barcode || null,
        categoryId: categoryId || null,
        laboratoryId: laboratoryId || null,
        unitMeasureId: unitMeasureId || null,
        presentation: presentation || 'unidad',
        price: price !== undefined ? parseFloat(price) : 0,
        costPrice: costPrice !== undefined ? parseFloat(costPrice) : 0,
        minStock: minStock !== undefined ? parseInt(minStock, 10) : 0,
        suppliers: Array.isArray(supplierIds) && supplierIds.length
          ? { create: supplierIds.map((sid: number) => ({ supplierId: sid })) }
          : undefined,
      },
    });
    logAction('info', `Producto creado: ${product.name} [SKU ${product.sku}]`, {}, { userId: req.user!.id });
    res.status(201).json(product);
  } catch (err) { next(err); }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { sku, name, barcode, categoryId, laboratoryId, unitMeasureId, presentation, price, costPrice, minStock, active, supplierIds } = req.body || {};
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Producto no encontrado' }); return; }

    let finalSku: string | undefined;
    if (sku !== undefined && String(sku).trim()) {
      const { sku: normalized } = validateSku(sku);
      const dup = await prisma.product.findUnique({ where: { sku: normalized } });
      if (dup && dup.id !== id) {
        res.status(409).json({ error: `El SKU ${normalized} ya existe para "${dup.name}"` });
        return;
      }
      finalSku = normalized;
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          sku: finalSku,
          name: name !== undefined ? String(name).trim() : undefined,
          barcode: barcode !== undefined ? barcode : undefined,
          categoryId: categoryId !== undefined ? categoryId || null : undefined,
          laboratoryId: laboratoryId !== undefined ? laboratoryId || null : undefined,
          unitMeasureId: unitMeasureId !== undefined ? unitMeasureId || null : undefined,
          presentation: presentation !== undefined ? presentation : undefined,
          price: price !== undefined ? parseFloat(price) : undefined,
          costPrice: costPrice !== undefined ? parseFloat(costPrice) : undefined,
          minStock: minStock !== undefined ? parseInt(minStock, 10) : undefined,
          active: active !== undefined ? Boolean(active) : undefined,
        },
      });
      if (Array.isArray(supplierIds)) {
        await tx.productSupplier.deleteMany({ where: { productId: id } });
        if (supplierIds.length) {
          await tx.productSupplier.createMany({
            data: supplierIds.map((sid: number) => ({ productId: id, supplierId: sid })),
            skipDuplicates: true,
          });
        }
      }
    });
    logAction('info', `Producto actualizado: ${existing.name}`, {}, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function deactivateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const p = await prisma.product.update({ where: { id }, data: { active: false } });
    logAction('info', `Producto desactivado: ${p.name}`, {}, { userId: req.user!.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function productStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const stocks = await prisma.stock.findMany({
      where: { productId: id, quantity: { gt: 0 } },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { expiryDate: 'asc' },
    });
    res.json(stocks);
  } catch (err) { next(err); }
}

// Export para reutilizar en logs/reportes
export { PRODUCT_INCLUDE };
