import crypto from 'crypto';

const SKU_REGEX = /^[A-Z0-9][A-Z0-9-]{2,29}$/;

/** Normaliza un SKU: mayusculas, sin espacios ni caracteres invalidos, ceros consecutivos internos corregidos. */
export function normalizeSku(raw: string): string {
  let sku = (raw || '').toUpperCase().trim();
  sku = sku.replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
  sku = sku.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  // Correccion de ceros: "000123" -> "123" (tambien "000-PARA-500" -> "PARA-500")
  sku = sku.replace(/^0+/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return sku;
}

export function isValidSkuFormat(sku: string): boolean {
  return SKU_REGEX.test(sku);
}

export function generateSku(prefix = 'SKU'): string {
  const p = normalizeSku(prefix) || 'SKU';
  const rand = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${p}-${rand.slice(0, 8)}`;
}

/** Toma hasta 3 iniciales de un texto: primera letra de cada palabra con letras; si faltan, completa con las siguientes letras de la primera palabra. */
export function initials3(text: string): string {
  const words = (text || '').toUpperCase().split(/[^A-Z0-9]+/).filter((w) => /^[A-Z]/.test(w));
  if (!words.length) return '000';
  let s = words.map((w) => w[0]).join('').slice(0, 3);
  if (s.length < 3) {
    s += words[0].slice(1).replace(/[^A-Z]/g, '').slice(0, 3 - s.length);
  }
  return s.padEnd(3, '0').slice(0, 3);
}

/** Extrae la dosis: el primer numero del nombre o de la presentacion (ej: "paracetamol 500mg" -> 500). */
export function dosageFromName(name: string, presentation = ''): string {
  const m = String(name || '').match(/\d+/);
  const p = String(presentation || '').match(/\d+/);
  return m ? m[0] : p ? p[0] : '000';
}

/** Base del SKU auto: 3 iniciales del nombre - 3 del laboratorio - dosis (ej: PAR-INT-500). */
export function buildSkuBase(name: string, labName: string, presentation: string): string {
  return `${initials3(name)}-${initials3(labName)}-${dosageFromName(name, presentation)}`;
}

/** Valida y devuelve el SKU corregido, o lanza un error descriptivo. */
export function validateSku(raw: string): { sku: string } {
  const sku = normalizeSku(raw);
  if (!sku) throw new Error('El SKU es obligatorio');
  if (!isValidSkuFormat(sku)) {
    throw new Error(
      'Formato de SKU invalido. Use 3 a 30 caracteres alfanumericos, opcionalmente separados por guiones.'
    );
  }
  return { sku };
}
