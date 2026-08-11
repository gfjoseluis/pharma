/** Normaliza valores monetarios escritos con coma o punto decimal (ej: "1,2" -> "1.2"). */

export const normalizeDec = (v: string): string => v.trim().replace(',', '.');

/** Valido si es numero no negativo (acepta "12", "12.5", "12,5"). */
export const isValidMoney = (value: string): boolean => {
  const n = parseFloat(normalizeDec(value));
  return /^\d+(\.\d+)?$/.test(normalizeDec(value)) && Number.isFinite(n) && n >= 0;
};

export const moneyToNumber = (value: string): number => {
  const n = parseFloat(normalizeDec(value));
  return Number.isFinite(n) ? n : 0;
};