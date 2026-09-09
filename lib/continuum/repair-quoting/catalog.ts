/**
 * Founder Geller SKU catalog lookup and deterministic search.
 * No LLM. Never silently chooses an ambiguous line.
 */

import catalogArtifact from "./catalog.json";
import type { GellerCatalogRow } from "./parse-export";
import type { GellerSourceAmounts } from "./source";

export type GellerCatalogArtifact = {
  source: {
    family: "geller_blue_book";
    version: "5.0";
    release: "6.50";
    editionLabel: string;
    exportFile: string;
    sha256: string;
    sheetName: string;
    sourceRowCount: number;
  };
  absentColumns: readonly string[];
  importedCount: number;
  rejectedCount: number;
  rejectionCounts: Record<string, number>;
  rows: GellerCatalogRow[];
};

const artifact = catalogArtifact as GellerCatalogArtifact;

const BY_SKU = new Map(artifact.rows.map((row) => [row.sku, row]));

export function gellerCatalogArtifact(): GellerCatalogArtifact {
  return artifact;
}

export function gellerCatalogRows(): readonly GellerCatalogRow[] {
  return artifact.rows;
}

export function lookupCatalogSku(sku: string): GellerCatalogRow | null {
  return BY_SKU.get(sku.trim()) ?? null;
}

const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["14k", "14kt", "fourteen"],
  ["10k", "10kt"],
  ["18k", "18kt"],
  ["size", "sizing"],
  ["up", "larger", "increase"],
  ["down", "smaller", "decrease"],
  ["yellow", "yg"],
  ["white", "wg"],
  ["head", "heads"],
  ["prong", "prongs"],
  ["bezel", "bezels"],
  ["replacement", "replace"],
  ["laser"],
  ["platinum", "plat"],
  ["reset", "re-set", "setting"],
  ["center", "centre"],
  ["stone", "stones"],
  ["narrow"],
];

const TOKEN_RE = /[a-z0-9]+(?:-[a-z0-9]+)*/g;

export function tokenizeSearchQuery(raw: string): string[] {
  const normalized = raw.toLowerCase().replace(/–/g, "-").replace(/14kt/g, "14k").replace(/10kt/g, "10k").replace(/18kt/g, "18k");
  const tokens = normalized.match(TOKEN_RE) ?? [];
  const expanded = new Set<string>();
  for (const token of tokens) {
    if (token.length === 0) continue;
    expanded.add(token);
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const alias of group) expanded.add(alias);
      }
    }
  }
  return [...expanded];
}

export type GellerSearchHit = {
  sku: string;
  taskDescription: string;
  category: string;
  amounts: GellerSourceAmounts;
  metalSemantics: GellerCatalogRow["metalSemantics"];
  inferredRepairType: GellerCatalogRow["inferredRepairType"];
  inferredMetalFamily: GellerCatalogRow["inferredMetalFamily"];
  score: number;
};

export type GellerSearchResult = {
  query: string;
  unique: boolean;
  exactSku: boolean;
  hits: GellerSearchHit[];
};

function toHit(row: GellerCatalogRow, score: number): GellerSearchHit {
  return {
    sku: row.sku,
    taskDescription: row.taskDescription,
    category: row.category,
    amounts: row.amounts,
    metalSemantics: row.metalSemantics,
    inferredRepairType: row.inferredRepairType,
    inferredMetalFamily: row.inferredMetalFamily,
    score,
  };
}

export function searchGellerCatalog(
  rawQuery: string,
  limit = 12,
): GellerSearchResult {
  const query = rawQuery.trim();
  if (!query) return { query, unique: false, exactSku: false, hits: [] };
  const exact = lookupCatalogSku(query);
  if (exact && /^\S+$/.test(query) && BY_SKU.has(query.trim())) {
    return {
      query,
      unique: true,
      exactSku: true,
      hits: [toHit(exact, 1000)],
    };
  }
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return { query, unique: false, exactSku: false, hits: [] };
  const scored: GellerSearchHit[] = [];
  for (const row of artifact.rows) {
    let score = 0;
    let matched = 0;
    for (const token of tokens) {
      if (row.searchText.includes(token)) {
        matched += 1;
        score += token.length >= 4 ? 4 : 2;
        if (row.sku.toLowerCase() === token) score += 50;
        if (row.category.toLowerCase().includes(token)) score += 2;
      }
    }
    if (matched === 0) continue;
    if (/size up|sizing up|larger/.test(query.toLowerCase()) && /larger/.test(row.searchText)) {
      score += 6;
    }
    if (/size down|sizing down|smaller/.test(query.toLowerCase()) && /smaller/.test(row.searchText)) {
      score += 6;
    }
    const coverage = matched / tokens.length;
    if (coverage < 0.34 && matched < 2) continue;
    score += Math.round(coverage * 10);
    scored.push(toHit(row, score));
  }
  scored.sort((a, b) => b.score - a.score || a.sku.localeCompare(b.sku));
  const hits = scored.slice(0, Math.max(1, Math.min(limit, 24)));
  const top = hits[0];
  const tied = top ? hits.filter((hit) => hit.score === top.score) : [];
  const unique = hits.length === 1 || tied.length === 1;
  return { query, unique, exactSku: false, hits };
}
