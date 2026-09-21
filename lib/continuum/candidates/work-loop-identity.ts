/**
 * Exact work-loop identity from HGD subjects and shop CAD filenames.
 * Read-model only. No fuzzy surname merge. Does not mint Person/Project.
 */

const HGD_CLIENT =
  /\bHGD\s*x\s+(.+?)-(C\d{5,})\b/i;
const SHOP_CAD_FILE =
  /NL-H017-(.+?)-(C\d{5,})(?:-|\.|$)/i;
const VENDOR_ORG_NAME = /\b(?:vlora|workshop|atelier|engrav)\b/i;

export type WorkLoopClientLabel = {
  name: string;
  cadId: string;
};

function compactName(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

export function parseHgdClientLabel(
  subject: string | null | undefined,
): WorkLoopClientLabel | null {
  const match = HGD_CLIENT.exec(subject ?? "");
  if (!match) return null;
  const name = compactName(match[1] ?? "");
  const cadId = (match[2] ?? "").toUpperCase();
  if (!name || !cadId) return null;
  if (VENDOR_ORG_NAME.test(name)) return { name: cadId, cadId };
  return { name, cadId };
}

export function parseShopCadFilename(
  filename: string | null | undefined,
): WorkLoopClientLabel | null {
  const match = SHOP_CAD_FILE.exec(filename ?? "");
  if (!match) return null;
  const name = compactName(match[1] ?? "");
  const cadId = (match[2] ?? "").toUpperCase();
  if (!name || !cadId) return null;
  if (VENDOR_ORG_NAME.test(name)) return { name: cadId, cadId };
  return { name, cadId };
}

export function currentCadTokensFromIdentityHay(
  texts: readonly (string | null | undefined)[],
): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  const push = (value: string | null | undefined) => {
    const cad = value?.trim().toUpperCase() ?? "";
    if (!cad || seen.has(cad)) return;
    if (!/^C\d{5,}$/i.test(cad)) return;
    seen.add(cad);
    tokens.push(cad);
  };
  for (const text of texts) {
    const hgd = parseHgdClientLabel(text);
    if (hgd) push(hgd.cadId);
    const shop = parseShopCadFilename(text);
    if (shop) push(shop.cadId);
  }
  return tokens;
}

export function clientLabelFromIdentityHay(
  texts: readonly (string | null | undefined)[],
): WorkLoopClientLabel | null {
  for (const text of texts) {
    const hgd = parseHgdClientLabel(text);
    if (hgd && !VENDOR_ORG_NAME.test(hgd.name)) return hgd;
  }
  for (const text of texts) {
    const shop = parseShopCadFilename(text);
    if (shop && !VENDOR_ORG_NAME.test(shop.name)) return shop;
  }
  return null;
}

export function canonicalWorkLoopId(input: {
  projectId?: string | null;
  cadId?: string | null;
  threadId?: string | null;
  fallbackId: string;
}): string {
  const projectId = input.projectId?.trim() ?? "";
  if (projectId) return `project:${projectId}`;
  const cadId = input.cadId?.trim().toUpperCase() ?? "";
  if (cadId) return `cad:${cadId}`;
  const threadId = input.threadId?.trim() ?? "";
  if (threadId) return `thread:${threadId}`;
  return `seed:${input.fallbackId}`;
}
