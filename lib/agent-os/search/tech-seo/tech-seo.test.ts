/**
 * Search & GEO / Technical SEO specialist — containment + report contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  EXECUTIVE_REGISTRY,
  isExecutiveOperational,
  listExecutives,
  registerConnector,
  clearRegisteredConnectors,
} from "../../index";
import * as techSeo from "./index";
import {
  runP1Tech1Closeout,
  REQUIRED_REPORT_SECTIONS,
  EVIDENCE_TABLE_COLUMNS,
  TECH_SEO_FORBIDDEN_EXPORT_NAMES,
  assertReportContract,
  classifySearchGeoPermissionTier,
  approvalRequiredForTier,
  INTENDED_CANONICAL_HOST,
} from "./index";
import {
  assertNotSiteSourceDestination,
  assertPathInsideAgentOsTmp,
  writeTechSeoArtifacts,
} from "./write-artifacts";
import type { LiveHttpProbe } from "./types";

const TECH_SEO_DIR = join(
  process.cwd(),
  "lib",
  "agent-os",
  "search",
  "tech-seo",
);

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".ts")) continue;
    out.push(join(dir, name));
  }
  return out;
}

describe("Tech SEO — registry containment", () => {
  it("keeps exactly five executives and Search Strategy operational", () => {
    assert.equal(EXECUTIVE_REGISTRY.length, 5);
    assert.deepEqual(
      listExecutives().map((e) => e.id),
      [
        "chief-of-staff",
        "business-intelligence",
        "search-strategy",
        "content",
        "opportunity",
      ],
    );
    assert.equal(isExecutiveOperational("search-strategy"), true);
    const search = EXECUTIVE_REGISTRY.find((e) => e.id === "search-strategy");
    assert.ok(
      search?.ownedDomains.some((d) =>
        /Technical SEO|Search & GEO/i.test(d),
      ),
    );
  });

  it("does not wire tech-seo into runSearchStrategy source", () => {
    const src = readFileSync(
      join(process.cwd(), "lib", "agent-os", "search", "index.ts"),
      "utf8",
    );
    assert.equal(src.includes("tech-seo"), false);
    assert.equal(src.includes("runP1Tech1Closeout"), false);
  });
});

describe("Tech SEO — mutation surface containment", () => {
  it("public audit API does not export apply/fix/patch/deploy APIs", () => {
    const exported = Object.keys(techSeo);
    for (const forbidden of TECH_SEO_FORBIDDEN_EXPORT_NAMES) {
      assert.equal(
        exported.includes(forbidden),
        false,
        `forbidden export present: ${forbidden}`,
      );
    }
    assert.equal(exported.includes("writeTechSeoArtifacts"), false);
    assert.equal(typeof techSeo.runP1Tech1Closeout, "function");
  });

  it("audit-core modules do not import filesystem write APIs", () => {
    const writeImport =
      /\b(writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream|rmSync|unlinkSync|renameSync)\b/;
    const files = listTsFiles(TECH_SEO_DIR).filter((f) => {
      const base = f.replace(/\\/g, "/");
      return (
        !base.endsWith("/write-artifacts.ts") &&
        !base.endsWith(".test.ts")
      );
    });
    assert.ok(files.length >= 8);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(
        writeImport.test(text),
        false,
        `write API import in audit core: ${file}`,
      );
    }
  });

  it("artifact writer is constrained to tmp/agent-os and refuses site destinations", () => {
    const root = join(process.cwd(), "tmp", "agent-os", "ok.json");
    assert.doesNotThrow(() => assertPathInsideAgentOsTmp(root));
    assert.throws(() =>
      assertPathInsideAgentOsTmp(join(process.cwd(), "app", "page.tsx")),
    );
    assert.throws(() =>
      assertNotSiteSourceDestination(
        join(process.cwd(), "app", "robots.ts"),
      ),
    );
    assert.throws(() =>
      assertNotSiteSourceDestination(
        join(process.cwd(), "docs", "seo", "x.md"),
      ),
    );
  });

  it("write-capable connectors remain rejected", () => {
    clearRegisteredConnectors();
    assert.throws(() =>
      registerConnector({
        id: "tech-seo-evil-write",
        capability: "write-capable",
        description: "should fail",
      }),
    );
  });
});

describe("Tech SEO — permission mapping", () => {
  it("YELLOW/RED recommendations require approval", () => {
    assert.equal(
      classifySearchGeoPermissionTier(
        "Edit metadata canonical on /diamond-studio",
      ),
      "yellow",
    );
    assert.equal(
      approvalRequiredForTier("yellow"),
      true,
    );
    assert.equal(
      classifySearchGeoPermissionTier("deploy production to vercel"),
      "red",
    );
    assert.equal(approvalRequiredForTier("red"), true);
    assert.equal(
      classifySearchGeoPermissionTier("Inspect sitemap coverage"),
      "green",
    );
    assert.equal(approvalRequiredForTier("green"), false);
  });
});

describe("Tech SEO — P1-TECH-1 closeout", () => {
  it("standalone audit returns valid structured output (repository mode)", async () => {
    const report = await runP1Tech1Closeout({
      mode: "repository",
      gscConfiguredOverride: false,
    });
    assert.equal(report.auditId, "P1-TECH-1");
    assert.equal(report.originatingExecutive, "search-strategy");
    assert.equal(report.intendedCanonicalHost, INTENDED_CANONICAL_HOST);
    assert.ok(report.evidenceRows.length > 0);
    assert.ok(report.inventory.some((i) => i.path === "/"));
    assert.ok(report.inventory.some((i) => i.path === "/privacy"));
    assert.ok(report.inventory.some((i) => i.path === "/ledger"));
    assert.ok(
      report.inventory.some((i) => i.path.startsWith("/diamond-guide/")),
    );
    assert.equal(report.gscReadiness.liveMetricsFetched, false);
    assert.equal(report.gscReadiness.fabricatedMetrics, false);
    assert.ok(report.gscReadiness.unavailableClaims.length > 0);

    const missing = assertReportContract(report.markdown);
    assert.deepEqual(missing, []);
    for (const section of REQUIRED_REPORT_SECTIONS) {
      assert.ok(report.markdown.includes(`## ${section}`));
    }
    for (const col of EVIDENCE_TABLE_COLUMNS) {
      assert.ok(report.markdown.includes(col));
    }

    // Privacy/terms must not be P1/P2 from generic SEO preference
    const legal = report.evidenceRows.filter(
      (r) => r.urlOrFile === "/privacy" || r.urlOrFile === "/terms",
    );
    assert.ok(legal.length > 0);
    for (const r of legal) {
      assert.equal(r.severity, "INFO");
      assert.match(r.expectedState, /INTENT NOT DECLARED/i);
    }

    for (const rec of report.recommendations) {
      if (rec.approvalRequired) {
        assert.ok(
          classifySearchGeoPermissionTier(rec.proposedAction) !== "green" ||
            rec.approvalRequired,
        );
      }
    }
    const yellowish = report.recommendations.filter((r) => r.approvalRequired);
    for (const r of yellowish) {
      assert.equal(r.approvalRequired, true);
    }
  });

  it("GSC unavailable => explicit gap and zero fabricated metrics", async () => {
    const report = await runP1Tech1Closeout({
      mode: "repository",
      gscConfiguredOverride: false,
    });
    assert.equal(report.gscReadiness.configured, false);
    assert.equal(report.gscReadiness.fabricatedMetrics, false);
    assert.ok(
      report.evidenceGaps.some((g) =>
        /GSC|Search Console|unavailable/i.test(g),
      ),
    );
    const gscRows = report.evidenceRows.filter(
      (r) => r.area === "GSC availability/gaps",
    );
    for (const r of gscRows) {
      assert.equal(/impressions=\d+|clicks=\d+|position=\d+/i.test(r.observedState), false);
    }
  });

  it("live HTTP failures soft-fail to UNKNOWN / INSUFFICIENT EVIDENCE", async () => {
    const failingProbe = async (url: string): Promise<LiveHttpProbe> => ({
      requestUrl: url,
      finalUrl: null,
      status: null,
      probeStatus: "unknown",
      locationHeader: null,
      canonicalHref: null,
      robotsMeta: null,
      soft404Risk: false,
      notes: ["forced failure"],
      error: "network down",
    });

    const report = await runP1Tech1Closeout({
      mode: "repository+live-http",
      liveProbe: failingProbe,
      gscConfiguredOverride: false,
    });

    assert.ok(
      report.evidenceGaps.some((g) => /UNKNOWN|INSUFFICIENT EVIDENCE/i.test(g)),
    );
    const httpRows = report.evidenceRows.filter(
      (r) => r.area === "Redirects/404s",
    );
    assert.ok(httpRows.every((r) => /UNKNOWN/i.test(r.observedState)));
    assert.ok(httpRows.every((r) => r.severity === "INFO"));
  });

  it("writes artifacts only under tmp/agent-os when using writer", async () => {
    const report = await runP1Tech1Closeout({
      mode: "repository",
      gscConfiguredOverride: false,
    });
    const paths = writeTechSeoArtifacts({
      stamp: "test-fixture-stamp",
      jsonBody: JSON.stringify({ verdict: report.verdict }),
      markdownBody: report.markdown,
    });
    assert.ok(paths.jsonPath.replace(/\\/g, "/").includes("tmp/agent-os/"));
    assert.ok(paths.mdPath.replace(/\\/g, "/").includes("tmp/agent-os/"));
    assert.ok(existsSync(paths.jsonPath));
    assert.ok(existsSync(paths.mdPath));
    assert.ok(paths.jsonPath.includes("tech-seo-p1-tech-1-"));
  });
});
