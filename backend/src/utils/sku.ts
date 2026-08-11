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
