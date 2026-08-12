/**
 * Constrained artifact writer for Technical SEO audits.
 *
 * NOT part of the audit API surface used by inspection modules.
 * Only the CLI (or tests) should import this file.
 * Writes exclusively under tmp/agent-os/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type TechSeoArtifactPaths = {
  jsonPath: string;
  mdPath: string;
  stamp: string;
};

function agentOsArtifactRoot(): string {
  return resolve(process.cwd(), "tmp", "agent-os");
}

export function assertPathInsideAgentOsTmp(absPath: string): void {
  const root = agentOsArtifactRoot();
  const resolved = resolve(absPath);
  const normalizedRoot = root.toLowerCase();
  const normalizedPath = resolved.toLowerCase();
  if (
    normalizedPath !== normalizedRoot &&
    !normalizedPath.startsWith(normalizedRoot + "\\") &&
    !normalizedPath.startsWith(normalizedRoot + "/")
  ) {
    throw new Error(
      `Tech SEO artifact writer refuses path outside tmp/agent-os: ${absPath}`,
    );
  }
}

/**
 * Refuse arbitrary site-source destinations.
 */
export function assertNotSiteSourceDestination(absPath: string): void {
  const resolved = resolve(absPath).toLowerCase().replace(/\\/g, "/");
  const banned = [
    "/app/",
    "/lib/seo/",
    "/docs/seo/",
    "/.review/",
    "/qa-artifacts/",
  ];
  for (const b of banned) {
    if (resolved.includes(b)) {
      throw new Error(
        `Tech SEO artifact writer refuses site/docs/protected destination: ${absPath}`,
      );
    }
  }
}

export function writeTechSeoArtifacts(input: {
  stamp?: string;
  jsonBody: string;
  markdownBody: string;
}): TechSeoArtifactPaths {
  const stamp =
    input.stamp ?? new Date().toISOString().replace(/[:.]/g, "-");
  const dir = agentOsArtifactRoot();
  mkdirSync(dir, { recursive: true });

  const jsonPath = join(dir, `tech-seo-p1-tech-1-${stamp}.json`);
  const mdPath = join(dir, `tech-seo-p1-tech-1-${stamp}.md`);

  assertPathInsideAgentOsTmp(jsonPath);
  assertPathInsideAgentOsTmp(mdPath);
  assertNotSiteSourceDestination(jsonPath);
  assertNotSiteSourceDestination(mdPath);

  writeFileSync(jsonPath, input.jsonBody, "utf8");
  writeFileSync(mdPath, input.markdownBody, "utf8");

  return { jsonPath, mdPath, stamp };
}
