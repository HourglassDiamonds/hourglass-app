/**
 * Read-only repository file helpers for Technical SEO audits.
 * Uses only filesystem READ APIs — no write/mutate imports.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export function repoRoot(): string {
  return process.cwd();
}

export function readRepoText(relativePath: string): string | null {
  const abs = join(repoRoot(), relativePath);
  if (!existsSync(abs)) return null;
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

export function repoFileExists(relativePath: string): boolean {
  return existsSync(join(repoRoot(), relativePath));
}

/**
 * Bounded walk for robots/noindex/canonical signals under app/ and lib/seo/.
 * Read-only. Caps file count to keep audits contained.
 */
export function scanRepoForPatterns(input: {
  roots: string[];
  extensions: string[];
  patterns: RegExp[];
  maxFiles?: number;
}): Array<{ file: string; matches: string[] }> {
  const maxFiles = input.maxFiles ?? 400;
  const hits: Array<{ file: string; matches: string[] }> = [];
  let visited = 0;

  function walk(dirRel: string): void {
    if (visited >= maxFiles) return;
    const abs = join(repoRoot(), dirRel);
    if (!existsSync(abs)) return;
    let entries: string[];
    try {
      entries = readdirSync(abs);
    } catch {
      return;
    }
    for (const name of entries) {
      if (visited >= maxFiles) return;
      if (
        name === "node_modules" ||
        name === ".next" ||
        name === "tmp" ||
        name === ".review" ||
        name === "qa-artifacts"
      ) {
        continue;
      }
      const childRel = join(dirRel, name).replace(/\\/g, "/");
      const childAbs = join(repoRoot(), childRel);
      let st;
      try {
        st = statSync(childAbs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(childRel);
        continue;
      }
      if (!input.extensions.some((ext) => name.endsWith(ext))) continue;
      visited += 1;
      const text = readRepoText(childRel);
      if (!text) continue;
      const matches: string[] = [];
      for (const re of input.patterns) {
        const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
        const global = new RegExp(re.source, flags);
        let m: RegExpExecArray | null;
        while ((m = global.exec(text)) !== null) {
          const line = text.slice(0, m.index).split(/\r?\n/).length;
          matches.push(`L${line}: ${m[0].slice(0, 120)}`);
          if (matches.length >= 8) break;
        }
        if (matches.length >= 8) break;
      }
      if (matches.length > 0) {
        hits.push({ file: childRel, matches });
      }
    }
  }

  for (const root of input.roots) {
    walk(root);
  }
  return hits;
}

export function relativeFromRepo(absPath: string): string {
  return relative(repoRoot(), absPath).replace(/\\/g, "/");
}
