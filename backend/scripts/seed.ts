import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';

const ALL_PERMISSIONS = [
  'dashboard', 'inventory', 'purchases', 'branches', 'pos', 'pos_qr',
  'invoices', 'reports', 'clients', 'users', 'licenses', 'backups', 'logs',
];

async function main(): Promise<void> {
  const adminPass = await bcrypt.hash('admin123', 10);
  const cashierPass = await bcrypt.hash('cajero123', 10);

  // Sucursal principal
  const mainBranch = await prisma.branch.upsert({
    where: { name: 'Sucursal Central' },
    create: { name: 'Sucursal Central', address: 'Av. Principal #100', type: 'grande' },
    update: {},
  });
  console.log('[OK] Sucursal Central');

  // Usuarios de prueba
  await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      password: adminPass,
      fullName: 'Administrador del Sistema',
      role: 'admin',
      branchId: mainBranch.id,
      permissions: ALL_PERMISSIONS,
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { username: 'cajero' },
    create: {
      username: 'cajero',
      password: cashierPass,
      fullName: 'Cajero de Turno',
      role: 'cajero',
      branchId: mainBranch.id,
      permissions: ['dashboard', 'pos', 'clients'],
    },
    update: {},
  });
  console.log('[OK] Usuarios de prueba: admin/admin123 y cajero/cajero123');

  // Catalogo basico
  const unidad = await prisma.unitMeasure.upsert({ where: { name: 'Unidad' }, create: { name: 'Unidad', shortName: 'u' }, update: {} });
  const caja = await prisma.unitMeasure.upsert({ where: { name: 'Caja' }, create: { name: 'Caja', shortName: 'caja' }, update: {} });
  const frasco = await prisma.unitMeasure.upsert({ where: { name: 'Frasco' }, create: { name: 'Frasco', shortName: 'fr' }, update: {} });

  const analgesicos = await prisma.category.upsert({ where: { name: 'Analgesicos' }, create: { name: 'Analgesicos' }, update: {} });
  const antibioticos = await prisma.category.upsert({ where: { name: 'Antibioticos' }, create: { name: 'Antibioticos' }, update: {} });
  await prisma.category.upsert({ where: { name: 'Vitaminas' }, create: { name: 'Vitaminas' }, update: {} });

  const labA = await prisma.laboratory.upsert({ where: { name: 'Laboratorio A' }, create: { name: 'Laboratorio A' }, update: {} });
  const labB = await prisma.laboratory.upsert({ where: { name: 'Laboratorio B' }, create: { name: 'Laboratorio B' }, update: {} });
  // Renombra laboratorios de ejemplo a nombres comerciales (SAE e Inti)
  await prisma.laboratory.updateMany({ where: { name: 'Laboratorio A' }, data: { name: 'SAE' } });
  await prisma.laboratory.updateMany({ where: { name: 'Laboratorio B' }, data: { name: 'Inti' } });
  const labSAE = await prisma.laboratory.upsert({ where: { name: 'SAE' }, create: { name: 'SAE' }, update: {} });
  const labInti = await prisma.laboratory.upsert({ where: { name: 'Inti' }, create: { name: 'Inti' }, update: {} });
  const labExtra = await prisma.laboratory.upsert({ where: { name: 'Bago' }, create: { name: 'Bago' }, update: {} });
  console.log('[OK] Catalogo de categorias, laboratorios (SAE, Inti, Bago) y unidades');

  const proveedor = await prisma.supplier.upsert({
    where: { ruc: '1000000000' },
    create: { name: 'Distribuidora Farmaceutica Nacional', ruc: '1000000000', phone: '2456789' },
    update: {},
  });
  await prisma.supplier.upsert({
    where: { ruc: '1000000001' },
    create: { name: 'Importadora Medica del Sur', ruc: '1000000001', phone: '2233445' },
    update: {},
  });
  console.log('[OK] Proveedores');

  // Productos de ejemplo con stock
  const vitaminas = (await prisma.category.findUnique({ where: { name: 'Vitaminas' } }))!;

  const productsData = [
    { sku: 'PARA-500', name: 'Paracetamol 500mg', ai: 'Paracetamol', categoryId: analgesicos.id, labId: labSAE.id, unitId: caja.id, presentation: 'comprimido', price: 8.5, cost: 5.0, min: 20 },
    { sku: 'PARA-1G', name: 'Paracetamol 1g', ai: 'Paracetamol', categoryId: analgesicos.id, labId: labInti.id, unitId: caja.id, presentation: 'comprimido', price: 12.0, cost: 7.0, min: 15 },
    { sku: 'PARA-100', name: 'Paracetamol 100ml', ai: 'Paracetamol', categoryId: analgesicos.id, labId: labInti.id, unitId: frasco.id, presentation: 'jarabe', price: 18.0, cost: 10.5, min: 10 },
    { sku: 'IBU-400', name: 'Ibuprofeno 400mg', ai: 'Ibuprofeno', categoryId: analgesicos.id, labId: labSAE.id, unitId: caja.id, presentation: 'comprimido', price: 12.0, cost: 7.5, min: 15 },
    { sku: 'AMO-500', name: 'Amoxicilina 500mg', ai: 'Amoxicilina', categoryId: antibioticos.id, labId: labSAE.id, unitId: caja.id, presentation: 'capsula', price: 25.0, cost: 16.0, min: 10 },
    { sku: 'VIT-C', name: 'Vitamina C 1g efervescente', ai: 'Acido ascorbico', categoryId: vitaminas.id, labId: labExtra.id, unitId: frasco.id, presentation: 'efervescente', price: 35.0, cost: 22.0, min: 8 },
    { sku: 'JAR-ABR', name: 'Jarabe para la tos 120ml', ai: 'Dextrometorfano', categoryId: analgesicos.id, labId: labInti.id, unitId: frasco.id, presentation: 'jarabe', price: 30.0, cost: 19.0, min: 6 },
  ];

  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      create: {
        sku: p.sku,
        name: p.name,
        activeIngredient: p.ai,
        categoryId: p.categoryId,
        laboratoryId: p.labId,
        unitMeasureId: p.unitId,
        presentation: p.presentation,
        price: p.price,
        costPrice: p.cost,
        minStock: p.min,
        suppliers: { create: [{ supplierId: proveedor.id }] },
      },
      update: { activeIngredient: p.ai, presentation: p.presentation, laboratoryId: p.labId, price: p.price, costPrice: p.cost },
    });
    const lot = `LOT-${p.sku}`;
    await prisma.stock.upsert({
      where: { branchId_productId_lot: { branchId: mainBranch.id, productId: product.id, lot } },
      create: { branchId: mainBranch.id, productId: product.id, lot, quantity: 100, expiryDate: new Date(Date.now() + 180 * 86400000) },
      update: { quantity: 100 },
    });
  }
  console.log('[OK] Productos de ejemplo con stock (100 uds c/u):');
  for (const p of productsData) console.log(`       ${p.name} - ${p.presentation} - ${p.labId === labSAE.id ? 'SAE' : p.labId === labInti.id ? 'Inti' : 'Bago'}`);

  // Licencias por defecto (activadas con codigos demo para uso inmediato)
  const demoLicenses: Record<string, string> = {
    POS: 'POS-1234-ABCD',
    QR: 'QR-4321-WXYZ',
    FACTURACION: 'FAC-5678-EFGH',
    REPORTES: 'REP-9999-MNOP',
    BACKUPS: 'BAK-1111-QRST',
    INVENTARIO: 'INV-2222-UVWX',
  };
  for (const [mod, key] of Object.entries(demoLicenses)) {
    await prisma.license.upsert({
      where: { module: mod },
      create: { module: mod, status: 'ACTIVE', license_key: key, activatedAt: new Date() },
      update: { status: 'ACTIVE', license_key: key, activatedAt: new Date() },
    });
  }
  console.log('[OK] Licencias demo activadas (eternas, sin expiracion).');
  console.log('');
  console.log('Codigos de licencia (puede desactivarlas en Configuracion > Licencias):');
  for (const [mod, key] of Object.entries(demoLicenses)) {
    console.log(`  ${mod.padEnd(11)} ${key}`);
  }
  console.log('');
  console.log('Login: admin/admin123 (acceso completo) | cajero/cajero123 (solo ventas)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
