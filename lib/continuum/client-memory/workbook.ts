/**
 * Continuum Reconciliation v3 workbook mapping.
 * Reads row-1 headers + used range. Ignores Excel table XML.
 */

import { coerceGmailThreadId, type GmailThreadCoercion } from "./gmail";
import {
  cadImportRowKey,
  peopleImportRowKey,
  projectImportRowKey,
  reviewQueueImportRowKey,
  salesImportRowKey,
} from "./hashes";
import { classifyPersonName } from "./classify";
import {
  cellNonEmpty,
  cellText,
  parseXlsxWorkbook,
  sheetByName,
  type CellScalar,
  type SheetTable,
  type WorkbookTables,
} from "./xlsx";
import type { PersonRowClass, ProjectMatchJudgment } from "./types";

export const REQUIRED_SHEETS = [
  "Reconciled Projects",
  "CAD & Files",
  "Sales History",
  "People",
  "Review Queue",
  "Rules & Summary",
  "Vlora Sources",
] as const;

export const WORKBOOK_AUDIT_EXPECTATIONS = {
  People: 122,
  "Reconciled Projects": 38,
  "Sales History": 210,
  "CAD & Files": 21,
  "Review Queue": 15,
  "Vlora Sources": 8,
} as const;

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
] as const;

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
] as const;

export type ParsedPersonRow = {
  excelRow: number;
  importRowKey: string;
  name: string;
  companyName: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  relationship: string;
  classification: PersonRowClass;
};

export type ParsedProjectRow = {
  excelRow: number;
  importRowKey: string;
  canonicalClient: string;
  clientDbMatchRaw: string;
  matchJudgment: ProjectMatchJudgment;
  displayTitle: string;
  cadJobNumber: string;
  orderNumber: string;
  projectDescription: string;
  fingerSize: CellScalar;
  metal: CellScalar;
  centerStone: CellScalar;
  supplyNotes: CellScalar;
  notes: CellScalar;
  gmailThreadId: CellScalar;
  gmailThread: GmailThreadCoercion;
  matchConfidenceRaw: string;
  reviewFlagRaw: string;
  matchConfidenceMalformed: boolean;
  reviewFlagMalformed: boolean;
  reviewFlagProse: string | null;
};

export type ParsedCadRow = {
  excelRow: number;
  importRowKey: string;
  client: string;
  filePointer: string;
  gmailThreadId: CellScalar;
  gmailThread: GmailThreadCoercion;
};

export type ParsedSalesRow = {
  excelRow: number;
  importRowKey: string;
  client: string;
  memo: string;
  matchNote: string;
};

export type ParsedReviewRow = {
  excelRow: number;
  importRowKey: string;
  issue: string;
  recommendedResolution: string;
  project: string;
};

export type ParsedWorkbook = {
  tables: WorkbookTables;
  people: ParsedPersonRow[];
  projects: ParsedProjectRow[];
  cad: ParsedCadRow[];
  sales: ParsedSalesRow[];
  reviewQueue: ParsedReviewRow[];
  vloraRows: number;
  rulesSummaryRows: number;
  missingSheets: string[];
  peopleNameCounts: Map<string, number>;
};

export function parseReconciliationWorkbook(buffer: Uint8Array): ParsedWorkbook {
  const tables = parseXlsxWorkbook(buffer);
  const missingSheets = REQUIRED_SHEETS.filter(
    (name) => !sheetByName(tables, name),
  );
  const peopleSheet = sheetByName(tables, "People");
  const projectSheet = sheetByName(tables, "Reconciled Projects");
  const cadSheet = sheetByName(tables, "CAD & Files");
  const salesSheet = sheetByName(tables, "Sales History");
  const reviewSheet = sheetByName(tables, "Review Queue");
  const vloraSheet = sheetByName(tables, "Vlora Sources");
  const rulesSheet = sheetByName(tables, "Rules & Summary");

  const people = (peopleSheet?.rows ?? []).map((row) => parsePeopleRow(row));
  const peopleNameCounts = new Map<string, number>();
  for (const row of people) {
    if (!row.name) continue;
    peopleNameCounts.set(row.name, (peopleNameCounts.get(row.name) ?? 0) + 1);
  }

  return {
    tables,
    people,
    projects: (projectSheet?.rows ?? []).map((row) => parseProjectRow(row)),
    cad: (cadSheet?.rows ?? []).map((row) => parseCadRow(row)),
    sales: (salesSheet?.rows ?? []).map((row) => parseSalesRow(row)),
    reviewQueue: (reviewSheet?.rows ?? []).map((row) => parseReviewRow(row)),
    vloraRows: vloraSheet?.rows.length ?? 0,
    rulesSummaryRows: rulesSheet?.rows.length ?? 0,
    missingSheets,
    peopleNameCounts,
  };
}

export function parseMatchJudgment(raw: string): ProjectMatchJudgment {
  const value = raw.trim();
  if (/^exact$/i.test(value)) return "exact";
  if (/^likely$/i.test(value)) return "likely";
  if (/^ambiguous$/i.test(value)) return "ambiguous";
  if (/^no exact/i.test(value)) return "no-exact";
  return "malformed-source-value";
}

export function isAllowedMatchConfidence(raw: string): boolean {
  return /^(high|medium|low)$/i.test(raw.trim());
}

export function isAllowedReviewFlag(raw: string): boolean {
  return /^(yes|no)$/i.test(raw.trim());
}

function parsePeopleRow(row: SheetTable["rows"][number]): ParsedPersonRow {
  const name = text(row.values, "Name");
  const companyName = text(row.values, "Company Name");
  return {
    excelRow: row.excelRow,
    importRowKey: peopleImportRowKey(row.excelRow),
    name,
    companyName,
    streetAddress: text(row.values, "Street Address"),
    city: text(row.values, "City"),
    state: text(row.values, "State"),
    country: text(row.values, "Country"),
    postalCode: text(row.values, "ZIP"),
    phone: text(row.values, "Phone"),
    email: text(row.values, "Email"),
    relationship: text(row.values, "Relationship"),
    classification: classifyPersonName(name, { companyName }),
  };
}

function parseProjectRow(row: SheetTable["rows"][number]): ParsedProjectRow {
  const reviewFlagRaw = text(row.values, "Review Flag");
  const matchConfidenceRaw = text(row.values, "Match Confidence");
  const reviewFlagMalformed =
    Boolean(reviewFlagRaw) && !isAllowedReviewFlag(reviewFlagRaw);
  return {
    excelRow: row.excelRow,
    importRowKey: projectImportRowKey(row.excelRow),
    canonicalClient: text(row.values, "Canonical Client"),
    clientDbMatchRaw: text(row.values, "Client DB Match"),
    matchJudgment: parseMatchJudgment(text(row.values, "Client DB Match")),
    displayTitle:
      text(row.values, "Gmail Project Name") ||
      text(row.values, "Project Description"),
    cadJobNumber: text(row.values, "CAD / Job #"),
    orderNumber: text(row.values, "Order #"),
    projectDescription: text(row.values, "Project Description"),
    fingerSize: scalar(row.values, "Finger Size"),
    metal: scalar(row.values, "Metal"),
    centerStone: scalar(row.values, "Center Stone / Dimensions"),
    supplyNotes: scalar(row.values, "Diamond / Supply Notes"),
    notes: scalar(row.values, "Notes"),
    gmailThreadId: scalar(row.values, "Gmail Thread ID"),
    gmailThread: coerceGmailThreadId(scalar(row.values, "Gmail Thread ID")),
    matchConfidenceRaw,
    reviewFlagRaw,
    matchConfidenceMalformed:
      Boolean(matchConfidenceRaw) &&
      !isAllowedMatchConfidence(matchConfidenceRaw),
    reviewFlagMalformed,
    reviewFlagProse: reviewFlagMalformed ? reviewFlagRaw : null,
  };
}

function parseCadRow(row: SheetTable["rows"][number]): ParsedCadRow {
  const gmailThreadId = scalar(row.values, "Gmail Thread ID");
  return {
    excelRow: row.excelRow,
    importRowKey: cadImportRowKey(row.excelRow),
    client: text(row.values, "Client"),
    filePointer: text(row.values, "File / Attachment"),
    gmailThreadId,
    gmailThread: coerceGmailThreadId(gmailThreadId),
  };
}

function parseSalesRow(row: SheetTable["rows"][number]): ParsedSalesRow {
  return {
    excelRow: row.excelRow,
    importRowKey: salesImportRowKey(row.excelRow),
    client: text(row.values, "Client"),
    memo: text(row.values, "Memo"),
    matchNote: text(row.values, "Match Note"),
  };
}

function parseReviewRow(row: SheetTable["rows"][number]): ParsedReviewRow {
  return {
    excelRow: row.excelRow,
    importRowKey: reviewQueueImportRowKey(row.excelRow),
    issue: text(row.values, "Issue"),
    recommendedResolution: text(row.values, "Recommended Resolution"),
    project: text(row.values, "Project"),
  };
}

function text(values: Record<string, CellScalar>, header: string): string {
  return cellText(values[header] ?? null);
}

function scalar(
  values: Record<string, CellScalar>,
  header: string,
): CellScalar {
  return values[header] ?? null;
}

export function hasNonEmpty(value: string | CellScalar): boolean {
  return cellNonEmpty(typeof value === "string" ? value.trim() : value);
}

export function isProseCandidate(value: CellScalar): boolean {
  return typeof value === "string" && value.trim() !== "";
}

export function isFingerSizeCandidate(value: CellScalar): boolean {
  if (typeof value === "number") return value > 0 && value <= 20;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/a|na|none|-|—)$/i.test(trimmed)) return false;
  return true;
}

export function isProjectAttributeCandidate(value: CellScalar): boolean {
  if (typeof value === "number") return value > 0 && value < 1000;
  return isProseCandidate(value);
}
