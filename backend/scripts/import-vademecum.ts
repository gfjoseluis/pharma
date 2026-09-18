import fs from 'fs';
import path from 'path';
import { prisma } from '../src/config/prisma';

/**
 * Importa el vademecum (web scraping) como catalogo de produccion.
 *
 * Uso:
 *   npx ts-node scripts/import-vademecum.ts                          -> dry-run (no escribe nada)
 *   npx ts-node scripts/import-vademecum.ts --apply                  -> importa a la BD actual
 *   npx ts-node scripts/import-vademecum.ts --apply --file=otro.sql  -> otro archivo fuente
 *
 * Mapeo: temp_productos.producto -> Product.name, ingrediente (|) -> principios
 * activos, forma -> Form, nicklaboratorio -> Laboratory, propaganda -> Category,
 * presentacion (keywords) -> UnitMeasure. Sin precios ni stock: el usuario los
 * carga con Compras. SKU secuencial VAD-000001...
 */

const MAX_LEN = 190;

function stripHtml(s: string): string {
  return (s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(s: string | null): string {
  return stripHtml(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
}

/** Divide una tupla SQL (a,b,'c,d',NULL,...) respetando comillas y escapes. */
function splitTuple(body: string): Array<string | null> {
  const out: Array<string | null> = [];
  let cur = '';
  let inStr = false;
  let isStr = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (c === '\\' && i + 1 < body.length) {
        const n = body[i + 1];
        cur += n === 'n' ? '\n' : n === 'r' ? '\r' : n === 't' ? '\t' : n;
        i++;
      } else if (c === "'") {
        if (body[i + 1] === "'") { cur += "'"; i++; }
        else inStr = false;
      } else {
        cur += c;
      }
    } else {
      if (c === "'") { inStr = true; isStr = true; cur = ''; }
      else if (c === ',') {
        out.push(isStr ? cur : cur.trim() === '' ? null : cur.trim() === 'NULL' ? null : cur.trim());
        cur = '';
        isStr = false;
      } else {
        cur += c;
      }
    }
  }
  out.push(isStr ? cur : cur.trim() === '' ? null : cur.trim() === 'NULL' ? null : cur.trim());
  return out;
}

/** Extrae las tuplas de un INSERT INTO tabla(...) VALUES (...),(...); */
function parseInserts(text: string, table: string): Array<Array<string | null>> {
  const rows: Array<Array<string | null>> = [];
  const re = new RegExp(`INSERT INTO ${table}\\([^)]*\\) VALUES `, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let i = re.lastIndex;
    let buf = '';
    let depth = 0;
    let inStr = false;
    // Recorre hasta cerrar el VALUES completo (punto y coma a profundidad 0).
    while (i < text.length) {
      const c = text[i];
      if (inStr) {
        buf += c;
        if (c === '\\' && i + 1 < text.length) { buf += text[i + 1]; i += 2; continue; }
        if (c === "'") inStr = false;
        i++;
        continue;
      }
      if (c === "'") { inStr = true; buf += c; i++; continue; }
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ';' && depth === 0) break;
      buf += c;
      i++;
    }
    re.lastIndex = i;
    // Divide el bloque en tuplas de nivel superior.
    let start = -1;
    depth = 0;
    inStr = false;
    for (let j = 0; j < buf.length; j++) {
      const c = buf[j];
      if (inStr) {
        if (c === '\\') j++;
        else if (c === "'") inStr = false;
        continue;
      }
      if (c === "'") { inStr = true; continue; }
      if (c === '(') { if (depth === 0) start = j; depth++; continue; }
      if (c === ')') {
        depth--;
        if (depth === 0 && start >= 0) {
          rows.push(splitTuple(buf.slice(start + 1, j)));
          start = -1;
        }
      }
    }
  }
  return rows;
}

function unitFor(presentacion: string): string {
  const p = presentacion.toLowerCase();
  if (/caja/.test(p)) return 'Caja';
  if (/frasco|gotero|jarabe|botella/.test(p)) return 'Frasco';
  return 'Unidad';
}

/** Mapa curado: accion terapeutica (vademecum) -> categoria de farmacia. */
const CATEGORY_RULES: Array<[string, string[]]> = [
  ['Antibioticos', ['antibi', 'antimicotic', 'antimicot', 'antifung', 'antiviral', 'antisept', 'antibacter', 'antimicrob']],
  ['Analgesicos', ['analges', 'antipiret', 'antiinflamat', 'antirreumat', 'anestes', 'artr']],
  ['Higiene bucal', ['bucal', 'dental', 'dentifr', 'enjuague']],
  ['Dermatologicos', ['dermat', 'dermicol', 'cicatriz', 'quemad', 'acne', 'psoriasis']],
  ['Oftalmicos', ['oftalm', 'ocular', 'lagrima', 'glaucoma']],
  ['Vitaminas', ['vitamin', 'suplemento', 'mineral', 'nutric', 'antioxidante', 'multivitamin']],
  ['Digestivos', ['digest', 'gastr', 'antiacid', 'laxant', 'antidiarre', 'hepat', 'gastroenter', 'antiulcer', 'antiemet', 'antiespasmod', 'peptica', 'hemorroid', 'antiflatul']],
  ['Cuidado personal', ['cosmet', 'higiene', 'champu', 'jabon', 'desodor', 'crema corporal', 'cabello', 'piel', 'protector solar', 'sanitizador', 'bloqueador', 'antitranspir', 'uva', 'rayos', 'fotoprotect']],
  ['Cardiovasculares', ['antihipertens', 'hipertension', 'cardio', 'vascular', 'coronari', 'hipotens', 'vasodilat', 'hipolipem', 'anticoagul', 'antiagreg']],
  ['Respiratorios', ['respirat', 'bronco', 'antitus', 'expector', 'descongest', 'antigripal', 'resfrio', 'mucolit', 'antiasmat']],
  ['Neurologicos', ['neuro', 'antiepilept', 'antiparkinson', 'ansiolit', 'antidepres', 'sedant', 'hipnot', 'anticonvuls', 'antimigran', 'antipsicot']],
  ['Infecciones urinarias', ['urinari']],
  ['Oncologia', ['antineoplas', 'citostat', 'oncolog']],
  ['Alergias', ['alerg', 'antihistamin']],
  ['Diabetes y endocrinos', ['diabet', 'hipoglucem', 'tiroid', 'hormon', 'endocrin']],
  ['Salud femenina', ['ginec', 'vaginal', 'anticoncept', 'embarazo', 'obstetr']],
  ['Pediatria y neonatologia', ['pediatr', 'neonat', 'infantil', 'lactan']],
  ['Antiparasitarios', ['antiparasit', 'antihelmint', 'antimalar', 'pedicul', 'antiprotoz']],
  ['Corticosteroides', ['cortic']],
  ['Antianemicos', ['antianem', 'hierro', 'ferro']],
  ['Insumos y equipamiento', ['mobiliario', 'quirofano', 'cirugia', 'esteril', 'insumo', 'jeringa', 'guante', 'venda', 'algodon', 'reactivo', 'desinfect']],
];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Categoria final segun accion terapeutica; resto a General. */
function categoryFor(action: string): string {
  const t = norm(action);
  for (const [group, kws] of CATEGORY_RULES) {
    if (kws.some((k) => t.includes(k))) return group;
  }
  return 'General';
}

/** Normaliza laboratorio y fusiona con los del seed (Inti, SAE, Bago). */
function normalizeLab(raw: string): string {
  const key = stripHtml(raw)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/\bINTI\b/.test(key)) return 'Inti';
  if (/\bSAE\b/.test(key)) return 'SAE';
  if (/\bBAGO\b/.test(key)) return 'Bago';
  return clean(raw) || 'Sin especificar';
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const fileArg = args.find((a) => a.startsWith('--file='));
  const file = fileArg ? fileArg.slice('--file='.length) : 'C:\\Users\\jhose\\Downloads\\medicamentos.sql';

  console.log(`Leyendo ${file}...`);
  const raw = fs.readFileSync(file, 'utf8');
  console.log(`Archivo: ${(raw.length / 1048576).toFixed(1)} MB`);

  const rows = parseInserts(raw, 'temp_productos');
  console.log(`Filas temp_productos: ${rows.length}`);

  // Columnas temp_productos: 0 id, 6 producto, 7 ingrediente, 8 propaganda,
  // 9 forma, 11 laboratorio, 12 nicklaboratorio, 31 ippapresentacion.
  interface Item {
    name: string;
    ingredients: string[];
    form: string;
    lab: string;
    category: string;
    therapeuticAction: string | null;
    unit: string;
  }
  const items: Item[] = [];
  const seen = new Set<string>();
  let skippedEmpty = 0;
  let skippedDupFile = 0;
  for (const r of rows) {
    const name = clean(r[6]);
    if (!name) { skippedEmpty++; continue; }
    const ingredients = String(r[7] || '')
      .split('|')
      .map((x) => clean(x))
      .filter((x) => x.length > 0);
    const formRaw = clean(r[9]) || 'Sin especificar';
    const form = formRaw.split('|')[0].trim() || 'Sin especificar';
    const lab = normalizeLab(r[12] || r[11] || '');
    const action = clean(r[8]) || null;
    const category = action ? categoryFor(action) : 'General';
    const unit = unitFor(stripHtml(r[31] || ''));
    const key = `${name}|||${form}|||${lab}`.toLowerCase();
    if (seen.has(key)) { skippedDupFile++; continue; }
    seen.add(key);
    items.push({ name, ingredients, form, lab, category, therapeuticAction: action, unit });
  }
  console.log(`Validos: ${items.length} | vacios omitidos: ${skippedEmpty} | duplicados en archivo: ${skippedDupFile}`);
  console.log(`Formas distintas: ${new Set(items.map((i) => i.form)).size}`);
  console.log(`Laboratorios distintos: ${new Set(items.map((i) => i.lab)).size}`);
  console.log(`Acciones terapeuticas distintas: ${new Set(items.map((i) => i.therapeuticAction || '-')).size}`);

  if (!apply) {
    console.log('');
    console.log('DRY-RUN: no se escribio nada. Reejecute con --apply para importar.');
    console.log('Muestra:');
    for (const s of items.slice(0, 5)) {
      console.log(`  - ${s.name} [${s.form}] ${s.lab} / ${s.category} / ${s.unit} / ing: ${s.ingredients.join(' + ') || '-'}`);
    }
    const preview = new Map<string, number>();
    for (const s of items) preview.set(s.category, (preview.get(s.category) || 0) + 1);
    console.log('Categorias finales:');
    for (const [c, n] of Array.from(preview.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${c}: ${n}`);
    }
    return;
  }

  // ---- APPLY ----
  const unitNames = Array.from(new Set(items.map((i) => i.unit)));
  for (const u of unitNames) {
    await prisma.unitMeasure.upsert({ where: { name: u }, create: { name: u }, update: {} });
  }
  const catIds = new Map<string, number>();
  for (const c of new Set(items.map((i) => i.category))) {
    const row = await prisma.category.upsert({ where: { name: c }, create: { name: c }, update: {} });
    catIds.set(c, row.id);
  }
  const formIds = new Map<string, number>();
  for (const f of new Set(items.map((i) => i.form))) {
    const row = await prisma.form.upsert({ where: { name: f }, create: { name: f }, update: {} });
    formIds.set(f, row.id);
  }
  const labIds = new Map<string, number>();
  for (const l of new Set(items.map((i) => i.lab))) {
    const row = await prisma.laboratory.upsert({ where: { name: l }, create: { name: l }, update: {} });
    labIds.set(l, row.id);
  }
  const unitIds = new Map<string, number>();
  for (const u of unitNames) {
    const row = await prisma.unitMeasure.findUnique({ where: { name: u } });
    unitIds.set(u, row!.id);
  }
  console.log('[OK] Catalogos (categorias, formas, laboratorios, unidades)');

  // SKU secuencial VAD-000001... (continua desde el maximo existente)
  const existingSkus = await prisma.product.findMany({
    where: { sku: { startsWith: 'VAD-' } },
    select: { sku: true },
  });
  let seq = 0;
  for (const e of existingSkus) {
    const m = e.sku.match(/^VAD-(\d+)$/);
    if (m) seq = Math.max(seq, parseInt(m[1], 10));
  }

  let created = 0;
  let skippedDupDb = 0;
  const errors: string[] = [];
  const BATCH = 100;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    try {
      await prisma.$transaction(async (tx) => {
        for (const it of chunk) {
          const dup = await tx.product.findFirst({
            where: { name: it.name, formId: formIds.get(it.form), laboratoryId: labIds.get(it.lab) },
            select: { id: true },
          });
          if (dup) { skippedDupDb++; continue; }
          seq++;
          await tx.product.create({
            data: {
              sku: `VAD-${String(seq).padStart(6, '0')}`,
              name: it.name,
              formId: formIds.get(it.form),
              categoryId: catIds.get(it.category),
              laboratoryId: labIds.get(it.lab),
              unitMeasureId: unitIds.get(it.unit),
              therapeuticAction: it.therapeuticAction,
              price: 0,
              costPrice: 0,
              minStock: 0,
              // Desactivados: el usuario los activa al fijar precio y stock (Compras).
              active: false,
              ingredients: it.ingredients.length > 0
                ? { create: it.ingredients.map((name) => ({ ingredient: name })) }
                : undefined,
            },
          });
          created++;
        }
      });
    } catch (err) {
      errors.push(`lote ${i}-${i + chunk.length}: ${err instanceof Error ? err.message : err}`);
    }
    if ((i / BATCH) % 10 === 0) console.log(`  ...${Math.min(i + BATCH, items.length)}/${items.length}`);
  }

  const report = {
    fecha: new Date().toISOString(),
    archivo: file,
    filas: rows.length,
    validos: items.length,
    creados: created,
    duplicadosArchivo: skippedDupFile,
    duplicadosBD: skippedDupDb,
    errores: errors,
  };
  const reportPath = path.resolve(__dirname, '..', 'logs', 'import-vademecum.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('');
  console.log(`[OK] Creados: ${created} | duplicados en BD: ${skippedDupDb} | errores: ${errors.length}`);
  console.log(`Reporte: ${reportPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
