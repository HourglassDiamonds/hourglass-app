/**
 * Synthetic XLSX builder for Client Memory tests.
 * Uses fictional names only — never real client PII.
 */

import { zipFromFiles } from "./xlsx-zip";

export type SyntheticCell =
  | string
  | number
  | boolean
  | null
  | { formula: string; value: string | number };

export type SyntheticSheet = {
  name: string;
  headers: string[];
  rows: SyntheticCell[][];
  /** Stale Excel table range, ignored by the parser. */
  staleTableRef?: string;
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colLetters(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export function buildSyntheticXlsx(sheets: SyntheticSheet[]): Buffer {
  const shared: string[] = [];
  const intern = (text: string): number => {
    const idx = shared.indexOf(text);
    if (idx >= 0) return idx;
    shared.push(text);
    return shared.length - 1;
  };

  const files: Record<string, string> = {
    "[Content_Types].xml": contentTypes(sheets),
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    "xl/workbook.xml": workbookXml(sheets),
    "xl/_rels/workbook.xml.rels": workbookRels(sheets),
  };

  sheets.forEach((sheet, i) => {
    const sheetPath = `xl/worksheets/sheet${i + 1}.xml`;
    files[sheetPath] = sheetXml(sheet, intern);
    if (sheet.staleTableRef) {
      files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
</Relationships>`;
      files["xl/tables/table1.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="PeopleTable" displayName="PeopleTable" ref="${xmlEscape(sheet.staleTableRef)}">
  <autoFilter ref="${xmlEscape(sheet.staleTableRef)}"/>
  <tableColumns count="9">
    <tableColumn id="1" name="Name"/>
  </tableColumns>
  <tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
</table>`;
    }
  });

  files["xl/sharedStrings.xml"] = sharedStringsXml(shared);
  return zipFromFiles(files);
}

function contentTypes(sheets: SyntheticSheet[]): string {
  const overrides = sheets
    .map(
      (_sheet, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  const table = sheets.some((s) => s.staleTableRef)
    ? `<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  ${overrides}
  ${table}
</Types>`;
}

function workbookXml(sheets: SyntheticSheet[]): string {
  const sheetTags = sheets
    .map(
      (sheet, i) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetTags}</sheets>
</workbook>`;
}

function workbookRels(sheets: SyntheticSheet[]): string {
  const rels = sheets
    .map(
      (_sheet, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
</Relationships>`;
}

function sheetXml(
  sheet: SyntheticSheet,
  intern: (text: string) => number,
): string {
  const rows = [sheet.headers, ...sheet.rows];
  const rowXml = rows
    .map((row, rowIdx) => {
      const excelRow = rowIdx + 1;
      const cells = row
        .map((cell, colIdx) => renderCell(cell, colIdx + 1, excelRow, intern))
        .join("");
      return `<row r="${excelRow}">${cells}</row>`;
    })
    .join("");
  const tableParts = sheet.staleTableRef
    ? `<tableParts count="1"><tablePart r:id="rId1"/></tableParts>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>${rowXml}</sheetData>
  ${tableParts}
</worksheet>`;
}

function renderCell(
  cell: SyntheticCell,
  col: number,
  row: number,
  intern: (text: string) => number,
): string {
  const ref = `${colLetters(col)}${row}`;
  if (cell == null) return `<c r="${ref}"/>`;
  if (typeof cell === "object" && "formula" in cell) {
    const v =
      typeof cell.value === "number" ? String(cell.value) : intern(String(cell.value));
    if (typeof cell.value === "number") {
      return `<c r="${ref}"><f>${xmlEscape(cell.formula)}</f><v>${cell.value}</v></c>`;
    }
    return `<c r="${ref}" t="s"><f>${xmlEscape(cell.formula)}</f><v>${v}</v></c>`;
  }
  if (typeof cell === "number") {
    return `<c r="${ref}"><v>${cell}</v></c>`;
  }
  if (typeof cell === "boolean") {
    return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
  }
  const idx = intern(cell);
  return `<c r="${ref}" t="s"><v>${idx}</v></c>`;
}

function sharedStringsXml(shared: string[]): string {
  const sis = shared
    .map((s) => `<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">
  ${sis}
</sst>`;
}

export const PEOPLE_HEADERS = [
  "Name",
  "Company Name",
  "Street Address",
  "City",
  "State",
  "Country",
  "ZIP",
  "Phone",
  "Email",
  "Attachments",
  "Open Balance",
  "Relationship",
  "Source",
  "Linked Project Rows",
  "Niurka/Vlora Match",
  "Reconciliation Status",
];

export const PROJECT_HEADERS = [
  "Canonical Client",
  "Client DB Match",
  "Client State",
  "Gmail Project Name",
  "CAD / Job #",
  "Order #",
  "Project Description",
  "Finger Size",
  "Metal",
  "Center Stone / Dimensions",
  "Diamond / Supply Notes",
  "Latest Credible Vlora Cost",
  "Cost Date",
  "QB Invoice #",
  "Invoice Date",
  "Gross Charged",
  "Sales Treatment",
  "Tax Rate",
  "Est. Tax",
  "Shipping",
  "Est. Pre-Tax Merchandise",
  "Est. Gross Profit",
  "Margin %",
  "Match Confidence",
  "Review Flag",
  "Notes",
  "Gmail Thread ID",
  "Vlora Rep",
];

export function personCells(input: {
  name: string;
  companyName?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  relationship?: string;
  linkedProjects?: number;
}): SyntheticCell[] {
  return [
    input.name,
    input.companyName ?? input.name,
    "1 Test Street",
    input.city ?? "Miami",
    input.state ?? "FL",
    "US",
    "33101",
    input.phone ?? "",
    input.email ?? "",
    "",
    0,
    input.relationship ?? "Client",
    "Uploaded Clients.xlsx",
    {
      formula: `COUNTIF('Reconciled Projects'!A:A,A2)`,
      value: input.linkedProjects ?? 0,
    },
    "Yes",
    "Reconciled",
  ];
}

export function projectCells(input: {
  canonicalClient: string;
  match: string;
  title: string;
  cad: string;
  finger?: string;
  metal?: string;
  stone?: string;
  supply?: string;
  confidence?: string;
  reviewFlag?: string;
  notes?: string;
  thread?: string;
}): SyntheticCell[] {
  return [
    input.canonicalClient,
    input.match,
    "FL",
    input.title,
    input.cad,
    "SO-1",
    input.title,
    input.finger ?? "",
    input.metal ?? "",
    input.stone ?? "",
    input.supply ?? "",
    1000,
    44927,
    "INV-1",
    44928,
    2000,
    "sale",
    0.07,
    140,
    0,
    1860,
    860,
    0.43,
    input.confidence ?? "High",
    input.reviewFlag ?? "YES",
    input.notes ?? "",
    input.thread ?? "",
    "Rep",
  ];
}

export function emptyWorkbookSheets(overrides?: {
  people?: SyntheticCell[][];
  projects?: SyntheticCell[][];
  cad?: SyntheticCell[][];
  sales?: SyntheticCell[][];
  review?: SyntheticCell[][];
  vlora?: SyntheticCell[][];
  rules?: SyntheticCell[][];
}): SyntheticSheet[] {
  return [
    {
      name: "Reconciled Projects",
      headers: PROJECT_HEADERS,
      rows: overrides?.projects ?? [],
    },
    {
      name: "CAD & Files",
      headers: [
        "Client",
        "Gmail Project",
        "CAD / Job #",
        "Order #",
        "File / Attachment",
        "File Type",
        "Status",
        "Gmail Thread ID",
        "Provenance",
      ],
      rows: overrides?.cad ?? [],
    },
    {
      name: "Sales History",
      headers: [
        "Date",
        "Type",
        "No.",
        "Client",
        "Memo",
        "Gross Amount",
        "Status",
        "Client State",
        "Sales Treatment",
        "Tax Rate",
        "Shipping",
        "Est. Tax",
        "Est. Pre-Tax Merchandise",
        "Match Note",
      ],
      rows: overrides?.sales ?? [],
    },
    {
      name: "People",
      headers: PEOPLE_HEADERS,
      rows: overrides?.people ?? [],
      staleTableRef: "A1:I11",
    },
    {
      name: "Review Queue",
      headers: [
        "Priority",
        "Client / Identity",
        "Project",
        "Issue",
        "Recommended Resolution",
        "Confidence",
      ],
      rows: overrides?.review ?? [],
    },
    {
      name: "Rules & Summary",
      headers: ["Rule", "Value"],
      rows: overrides?.rules ?? [["Projects", 18], ["People", 10]],
    },
    {
      name: "Vlora Sources",
      headers: [
        "Sender / Mailbox",
        "Email",
        "Observed Role",
        "Observed Coverage",
        "Notes",
      ],
      rows: overrides?.vlora ?? [
        ["Vendor Desk", "vendor@example.com", "vendor", "CAD", "skip"],
      ],
    },
  ];
}
