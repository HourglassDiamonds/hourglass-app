import { normalizeOcrText } from "./normalization";

/**
 * Repair collapsed diagram numerals (345° → 34.5°, 147mm → 14.7%).
 * Preserves stone measurement strings (7.98-8.01 x 4.88mm, 0.02mm).
 */
export function repairDiagramNumericSoup(text: string): string {
  const placeholders: string[] = [];
  let s = text;

  const protect = (re: RegExp) => {
    s = s.replace(re, (m) => {
      const i = placeholders.length;
      placeholders.push(m);
      return `__GCAL_MEAS_${i}__`;
    });
  };

  s = s.replace(/\b(\d)\s+(\d{2})\s*mm\b/gi, "$1.$2mm");

  protect(/\b\d\.\d{2}\s*[-–—]\s*\d\.\d{2}\s*x\s*\d(?:\.\d{1,2})?\s*mm\b/gi);
  protect(/\b0\.0\d{1,2}\s*mm\b/gi);
  protect(/\b\d\.\d{2}\s*mm\b/gi);

  s = s.replace(/\b(\d{2})(\d)°/g, "$1.$2°");
  s = s.replace(/\b(\d{2})(\d)%/g, "$1.$2%");
  s = s.replace(/\b(\d{2})(\d)mm\b/g, "$1.$2%");
  s = s.replace(/\b(\d)(\d)mm\b/g, "$1.$2%");

  for (let i = 0; i < placeholders.length; i++) {
    s = s.replaceAll(`__GCAL_MEAS_${i}__`, placeholders[i]!);
  }

  return s;
}

export function prepareProportionDiagramText(text: string): string {
  return repairDiagramNumericSoup(normalizeOcrText(text));
}

/** @deprecated alias */
export const repairGcalDiagramNumericSoup = repairDiagramNumericSoup;
