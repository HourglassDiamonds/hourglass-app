/**
 * XLSX used-range reader.
 * Ignores Excel table XML (stale table definitions must not bound the parse).
 */

import { unzipToMap } from "./xlsx-zip";

export type CellScalar = string | number | boolean | null;

export type SheetTable = {
  name: string;
  headers: string[];
  rows: Array<{ excelRow: number; values: Record<string, CellScalar> }>;
};

export type WorkbookTables = {
  sheets: SheetTable[];
};

function xmlUnescape(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function colRow(ref: string): { col: number; row: number } | null {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(m[2]) };
}

function attr(source: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(source);
  return m ? xmlUnescape(m[1]) : null;
}

function loadSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const texts = [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((hit) =>
      xmlUnescape(hit[1]),
    );
    strings.push(texts.join(""));
  }
  return strings;
}

function cellValue(
  attrs: string,
  inner: string,
  shared: string[],
): CellScalar {
  const type = attr(attrs, "t");
  if (type === "inlineStr") {
    const text = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
    return text ? xmlUnescape(text[1]) : "";
  }
  const v = inner.match(/<v>([\s\S]*?)<\/v>/);
  const raw = v ? v[1] : "";
  if (type === "s") {
    const idx = Number(raw);
    return Number.isFinite(idx) ? (shared[idx] ?? "") : "";
  }
  if (type === "b") return raw === "1" || raw === "true";
  if (type === "str" || type === "e") return xmlUnescape(raw);
  if (!raw) {
    const inline = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
    return inline ? xmlUnescape(inline[1]) : null;
  }
  const num = Number(raw);
  return Number.isFinite(num) && raw.trim() !== "" ? num : xmlUnescape(raw);
}

function parseSheetCells(
  xml: string,
  shared: string[],
): Map<string, { col: number; row: number; value: CellScalar }> {
  const cells = new Map<string, { col: number; row: number; value: CellScalar }>();
  const cRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m: RegExpExecArray | null;
  while ((m = cRe.exec(xml))) {
    const attrs = m[1] ?? "";
    const inner = m[2] ?? "";
    const ref = attr(attrs, "r");
    if (!ref) continue;
    const parsed = colRow(ref);
    if (!parsed) continue;
    const value = cellValue(attrs, inner, shared);
    cells.set(`${parsed.col}:${parsed.row}`, { ...parsed, value });
  }
  return cells;
}

function isEmpty(value: CellScalar): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

export function parseXlsxWorkbook(buffer: Uint8Array): WorkbookTables {
  const files = unzipToMap(buffer);
  const decoder = new TextDecoder("utf-8");
  const read = (path: string): string | undefined => {
    const hit = files.get(path) ?? files.get(path.replace(/^\/+/, ""));
    return hit ? decoder.decode(hit) : undefined;
  };

  const shared = loadSharedStrings(read("xl/sharedStrings.xml"));
  const workbookXml = read("xl/workbook.xml");
  if (!workbookXml) throw new Error("xlsx: missing workbook.xml");
  const relsXml = read("xl/_rels/workbook.xml.rels") ?? "";
  const relTarget = new Map<string, string>();
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relTarget.set(m[1], m[2].replace(/^\//, ""));
  }
  // Some files reverse attribute order.
  for (const m of relsXml.matchAll(/Target="([^"]+)"[^>]*Id="([^"]+)"/g)) {
    if (!relTarget.has(m[2])) relTarget.set(m[2], m[1].replace(/^\//, ""));
  }

  const sheets: SheetTable[] = [];
  const sheetRe = /<sheet\b([^>]*)\/?>/g;
  let sm: RegExpExecArray | null;
  while ((sm = sheetRe.exec(workbookXml))) {
    const attrs = sm[1] ?? "";
    const name = attr(attrs, "name");
    const rid = attr(attrs, "r:id") ?? attr(attrs, "id");
    if (!name || !rid) continue;
    const target = relTarget.get(rid);
    if (!target) continue;
    const sheetPath = target.startsWith("xl/") ? target : `xl/${target}`;
    const xml = read(sheetPath);
    if (!xml) continue;
    const cells = parseSheetCells(xml, shared);
    let maxCol = 0;
    let maxRow = 0;
    for (const cell of cells.values()) {
      if (isEmpty(cell.value)) continue;
      if (cell.col > maxCol) maxCol = cell.col;
      if (cell.row > maxRow) maxRow = cell.row;
    }
    const headerCells = [...cells.values()].filter((cell) => cell.row === 1);
    for (const cell of headerCells) {
      if (cell.col > maxCol) maxCol = cell.col;
    }
    const headers: string[] = [];
    for (let col = 1; col <= maxCol; col += 1) {
      const cell = cells.get(`${col}:1`);
      const header =
        cell && cell.value != null && String(cell.value).trim()
          ? String(cell.value).trim()
          : `column_${col}`;
      headers.push(header);
    }
    const rows: SheetTable["rows"] = [];
    for (let row = 2; row <= maxRow; row += 1) {
      const values: Record<string, CellScalar> = {};
      let empty = true;
      for (let col = 1; col <= maxCol; col += 1) {
        const header = headers[col - 1];
        const cell = cells.get(`${col}:${row}`);
        const value = cell ? cell.value : null;
        values[header] = value;
        if (!isEmpty(value)) empty = false;
      }
      if (empty) continue;
      rows.push({ excelRow: row, values });
    }
    sheets.push({ name, headers, rows });
  }

  return { sheets };
}

export function sheetByName(
  workbook: WorkbookTables,
  name: string,
): SheetTable | null {
  return workbook.sheets.find((sheet) => sheet.name === name) ?? null;
}

export function cellText(value: CellScalar): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value).trim();
}

export function cellNonEmpty(value: CellScalar): boolean {
  return !isEmpty(typeof value === "string" ? value.trim() : value);
}
