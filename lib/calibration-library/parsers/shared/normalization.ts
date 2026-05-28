/** Collapse OCR whitespace and fix common numeral/symbol glitches. */
export function normalizeOcrText(text: string): string {
  if (!text.trim()) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00b0/g, "°")
    .replace(/[°º˚]/g, "°")
    .replace(/(\d)O\.(\d)/gi, "$10.$2")
    .replace(/(\d)\s*,\s*(\d)/g, "$1.$2")
    .replace(/(\d)\s+\.\s+(\d)/g, "$1.$2")
    .replace(/(\d)\s+(\d{1,2})\s*(?=°|H\b)/gi, (_, a, b) => `${a}.${b}`)
    .replace(/(\d{1,3}(?:\.\d+)?)\s*H\b/gi, "$1°")
    .replace(/(\d)\s*O\b(?!\w)/gi, "$1°")
    .replace(/(\d)\s*%/g, "$1%")
    .replace(/(\d)\s*°/g, "$1°")
    .replace(/[×✕]/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDocumentText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
