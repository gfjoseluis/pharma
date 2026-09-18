import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';
import { ALL_ACTIONS } from '../src/config/actions';

const ALL_PERMISSIONS = ALL_ACTIONS;

async function main(): Promise<void> {
  // --prod: semilla de produccion (sin productos/clientes/stock de prueba).
  const isProd = process.argv.includes('--prod');
  if (isProd) console.log('[INFO] Modo produccion: solo sucursal, usuarios, catalogos base y licencias.');
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
    update: {
      branchId: mainBranch.id,
      permissions: ALL_PERMISSIONS,
    },
  });
  await prisma.user.upsert({
    where: { username: 'cajero' },
    create: {
      username: 'cajero',
      password: cashierPass,
      fullName: 'Cajero de Turno',
      role: 'cajero',
      branchId: mainBranch.id,
      permissions: [
        'dashboard.view', 'pos.view', 'pos.sale',
        'cash.view', 'cash.open', 'cash.close',
        'sales.view', 'sales.annul',
        'clients.view', 'clients.create',
        'products.view',
      ],
    },
    update: {
      branchId: mainBranch.id,
      permissions: [
        'dashboard.view', 'pos.view', 'pos.sale',
        'cash.view', 'cash.open', 'cash.close',
        'sales.view', 'sales.annul',
        'clients.view', 'clients.create',
        'products.view',
      ],
    },
  });
  console.log('[OK] Usuarios de prueba: admin/admin123 y cajero/cajero123');

  // Unidades de medida
  const unidad = await prisma.unitMeasure.upsert({ where: { name: 'Unidad' }, create: { name: 'Unidad', shortName: 'u' }, update: {} });
  const caja = await prisma.unitMeasure.upsert({ where: { name: 'Caja' }, create: { name: 'Caja', shortName: 'caja' }, update: {} });
  const frasco = await prisma.unitMeasure.upsert({ where: { name: 'Frasco' }, create: { name: 'Frasco', shortName: 'fr' }, update: {} });

  // Categorias con descripcion
  await prisma.category.upsert({ where: { name: 'Analgesicos' }, create: { name: 'Analgesicos', description: 'Alivian el dolor' }, update: {} });
  await prisma.category.upsert({ where: { name: 'Antibioticos' }, create: { name: 'Antibioticos', description: 'Combaten infecciones bacterianas' }, update: {} });
  await prisma.category.upsert({ where: { name: 'Vitaminas' }, create: { name: 'Vitaminas', description: 'Suplementos y vitaminas' }, update: {} });

  // Formas farmaceuticas
  const fComprimido = await prisma.form.upsert({ where: { name: 'Comprimido' }, create: { name: 'Comprimido', description: 'Tableta solida oral' }, update: {} });
  const fJarabe = await prisma.form.upsert({ where: { name: 'Jarabe' }, create: { name: 'Jarabe', description: 'Solucion oral dulce' }, update: {} });
  const fCapsula = await prisma.form.upsert({ where: { name: 'Capsula' }, create: { name: 'Capsula', description: 'Envuelta de gelatina' }, update: {} });
  const fEfervescente = await prisma.form.upsert({ where: { name: 'Efervescente' }, create: { name: 'Efervescente', description: 'Se disuelve en agua' }, update: {} });
  await prisma.form.upsert({ where: { name: 'Crema' }, create: { name: 'Crema', description: 'Uso topico' }, update: {} });
  await prisma.form.upsert({ where: { name: 'Inyectable' }, create: { name: 'Inyectable', description: 'Uso parenteral' }, update: {} });
  await prisma.form.upsert({ where: { name: 'Suspension' }, create: { name: 'Suspension', description: 'Liquido que se agita' }, update: {} });
  console.log('[OK] Formas farmaceuticas, categorias con descripcion y unidades');

  // Laboratorios
  const labSAE = await prisma.laboratory.upsert({ where: { name: 'SAE' }, create: { name: 'SAE' }, update: {} });
  const labInti = await prisma.laboratory.upsert({ where: { name: 'Inti' }, create: { name: 'Inti' }, update: {} });
  const labBago = await prisma.laboratory.upsert({ where: { name: 'Bago' }, create: { name: 'Bago' }, update: {} });
  console.log('[OK] Laboratorios (SAE, Inti, Bago)');

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

  const analgesicos = (await prisma.category.findUnique({ where: { name: 'Analgesicos' } }))!;
  const antibioticos = (await prisma.category.findUnique({ where: { name: 'Antibioticos' } }))!;
  const vitaminas = (await prisma.category.findUnique({ where: { name: 'Vitaminas' } }))!;

  interface SeedProduct {
    sku: string;
    name: string;
    formId: number;
    ingredients: Array<{ ingredient: string; concentration: string }>;
    categoryId: number;
    labId: number;
    unitId: number;
    price: number;
    cost: number;
    min: number;
    restrictedUse?: boolean;
    restrictions?: Array<{ restrictionType: string; notes: string }>;
  }

  const productsData: SeedProduct[] = isProd ? [] : [
    {
      sku: 'PAR-INT-500-0001', name: 'Paracetamol 500mg', formId: fComprimido.id,
      ingredients: [{ ingredient: 'Paracetamol', concentration: '500 mg' }],
      categoryId: analgesicos.id, labId: labSAE.id, unitId: caja.id, price: 8.5, cost: 5.0, min: 20,
    },
    {
      sku: 'PAR-INT-1000-0001', name: 'Paracetamol 1g', formId: fComprimido.id,
      ingredients: [{ ingredient: 'Paracetamol', concentration: '1 g' }],
      categoryId: analgesicos.id, labId: labInti.id, unitId: caja.id, price: 12.0, cost: 7.0, min: 15,
    },
    {
      sku: 'PAR-INT-100-0001', name: 'Paracetamol 100ml', formId: fJarabe.id,
      ingredients: [{ ingredient: 'Paracetamol', concentration: '100 mg/5 ml' }],
      categoryId: analgesicos.id, labId: labInti.id, unitId: frasco.id, price: 18.0, cost: 10.5, min: 10,
    },
    {
      sku: 'IBU-INT-400-0001', name: 'Ibuprofeno 400mg', formId: fComprimido.id,
      ingredients: [{ ingredient: 'Ibuprofeno', concentration: '400 mg' }],
      categoryId: analgesicos.id, labId: labSAE.id, unitId: caja.id, price: 12.0, cost: 7.5, min: 15,
    },
    {
      sku: 'AMO-INT-500-0001', name: 'Amoxicilina 500mg', formId: fCapsula.id,
      ingredients: [{ ingredient: 'Amoxicilina', concentration: '500 mg' }],
      categoryId: antibioticos.id, labId: labSAE.id, unitId: caja.id, price: 25.0, cost: 16.0, min: 10,
    },
    {
      sku: 'AMO-INT-500-0002', name: 'Amoxicilina + Acido Clavulanico 500/125', formId: fComprimido.id,
      ingredients: [
        { ingredient: 'Amoxicilina', concentration: '500 mg' },
        { ingredient: 'Acido clavulanico', concentration: '125 mg' },
      ],
      categoryId: antibioticos.id, labId: labSAE.id, unitId: caja.id, price: 42.0, cost: 28.0, min: 8,
      restrictedUse: true,
      restrictions: [{ restrictionType: 'Norma PAI', notes: 'Antibiotico de alto uso: venta con receta medica' }],
    },
    {
      sku: 'MIG-INT-0001', name: 'Migral Compuesto', formId: fComprimido.id,
      ingredients: [
        { ingredient: 'Ergotamina', concentration: '1 mg' },
        { ingredient: 'Paracetamol', concentration: '200 mg' },
        { ingredient: 'Cafeina', concentration: '100 mg' },
      ],
      categoryId: analgesicos.id, labId: labInti.id, unitId: caja.id, price: 15.0, cost: 9.0, min: 10,
    },
    {
      sku: 'VIT-BAG-1000-0001', name: 'Vitamina C 1g efervescente', formId: fEfervescente.id,
      ingredients: [{ ingredient: 'Acido ascorbico', concentration: '1 g' }],
      categoryId: vitaminas.id, labId: labBago.id, unitId: frasco.id, price: 35.0, cost: 22.0, min: 8,
    },
    {
      sku: 'JAR-INT-120-0001', name: 'Jarabe para la tos 120ml', formId: fJarabe.id,
      ingredients: [{ ingredient: 'Dextrometorfano', concentration: '15 mg/5 ml' }],
      categoryId: analgesicos.id, labId: labInti.id, unitId: frasco.id, price: 30.0, cost: 19.0, min: 6,
    },
  ];

  // Escenarios de prueba por SKU: lotes validos, vencidos, bajos y por vencer.
  const now = Date.now();
  const day = 86400000;
  const stockPlan: Record<string, Array<{ lot: string; qty: number; expDays: number | null }>> = {
    'PAR-INT-500-0001': [{ lot: 'LOT-PAR-500-A', qty: 8, expDays: 200 }], // bajo stock (min 20)
    'PAR-INT-1000-0001': [{ lot: 'LOT-PAR-1000-A', qty: 100, expDays: 180 }],
    'PAR-INT-100-0001': [{ lot: 'LOT-PAR-JAR-A', qty: 0, expDays: 180 }], // sin stock
    'IBU-INT-400-0001': [{ lot: 'LOT-IBU-400-A', qty: 30, expDays: 20 }], // por vencer
    'AMO-INT-500-0001': [
      { lot: 'LOT-AMO-500-OK', qty: 100, expDays: 300 },
      { lot: 'LOT-AMO-500-VENC', qty: 100, expDays: -30 }, // 100 vencidas bloqueadas
    ],
    'AMO-INT-500-0002': [
      { lot: 'LOT-AMX-500-A', qty: 50, expDays: 240 },
      { lot: 'LOT-AMX-500-B', qty: 12, expDays: 10 }, // por vencer
    ],
    'MIG-INT-0001': [{ lot: 'LOT-MIG-A', qty: 40, expDays: 180 }],
    'VIT-BAG-1000-0001': [{ lot: 'LOT-VIT-A', qty: 5, expDays: 365 }], // bajo stock (min 8)
    'JAR-INT-120-0001': [
      { lot: 'LOT-JAR-A', qty: 3, expDays: 300 }, // bajo stock (min 6)
      { lot: 'LOT-JAR-VENC', qty: 20, expDays: -60 }, // vencidas bloqueadas
    ],
  };

  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      create: {
        sku: p.sku,
        name: p.name,
        formId: p.formId,
        restrictedUse: Boolean(p.restrictedUse),
        categoryId: p.categoryId,
        laboratoryId: p.labId,
        unitMeasureId: p.unitId,
        price: p.price,
        costPrice: p.cost,
        minStock: p.min,
        ingredients: { create: p.ingredients.map((i) => ({ ingredient: i.ingredient, concentration: i.concentration })) },
        restrictions: p.restrictions ? { create: p.restrictions.map((r) => ({ restrictionType: r.restrictionType, notes: r.notes })) } : undefined,
        suppliers: { create: [{ supplierId: proveedor.id }] },
      },
      update: {
        name: p.name,
        formId: p.formId,
        restrictedUse: Boolean(p.restrictedUse),
        categoryId: p.categoryId,
        laboratoryId: p.labId,
        unitMeasureId: p.unitId,
        price: p.price,
        costPrice: p.cost,
        minStock: p.min,
      },
    });
    const lots = stockPlan[p.sku] || [{ lot: `LOT-${p.sku}`, qty: 100, expDays: 180 }];
    for (const l of lots) {
      await prisma.stock.upsert({
        where: { branchId_productId_lot: { branchId: mainBranch.id, productId: product.id, lot: l.lot } },
        create: {
          branchId: mainBranch.id,
          productId: product.id,
          lot: l.lot,
          quantity: l.qty,
          expiryDate: l.expDays === null ? null : new Date(now + l.expDays * day),
        },
        update: {
          quantity: l.qty,
          expiryDate: l.expDays === null ? null : new Date(now + l.expDays * day),
        },
      });
    }
  }
  console.log('[OK] Productos de ejemplo con escenarios de stock (vencidos, bajos, por vencer):');
  for (const p of productsData) {
    const formName = (p.formId === fComprimido.id ? 'Comprimido' : p.formId === fJarabe.id ? 'Jarabe' : p.formId === fCapsula.id ? 'Capsula' : 'Efervescente');
    const labName = p.labId === labSAE.id ? 'SAE' : p.labId === labInti.id ? 'Inti' : 'Bago';
    console.log(`       ${p.name} -> ${p.ingredients.map((i) => i.ingredient).join(' + ')} -> ${formName} -> ${labName}${p.restrictedUse ? ' [USO RESTRINGIDO]' : ''}`);
  }

  // Clientes de prueba (solo en desarrollo; en produccion el usuario los registra)
  if (!isProd) {
  await prisma.client.upsert({
    where: { ciNit: '1234567' },
    create: { name: 'Juan Perez', ciNit: '1234567', phone: '70011122' },
    update: {},
  });
  await prisma.client.upsert({
    where: { ciNit: '7654321-1B' },
    create: { name: 'Farmacia Vecina SRL', ciNit: '7654321-1B', phone: '70033344' },
    update: {},
  });
  console.log('[OK] Clientes de prueba (Juan Perez, Farmacia Vecina SRL)');
  }

  // Licencias por defecto (activadas con codigos demo para uso inmediato)
  const demoLicenses: Record<string, string> = {
    POS: 'POS-1234-ABCD',
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
  console.log('[OK] Licencias demo activadas (POS, REPORTES, BACKUPS, INVENTARIO).');
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
