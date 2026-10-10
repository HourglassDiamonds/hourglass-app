import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUFFER_HEALTH_DOMAINS } from "@/app/ledger/buffer-health-data";
import {
  OCTOBER_10_LEDGER_COMMIT,
  OCTOBER_10_LEDGER_PUBLICATION,
} from "./baseline-publication";
import { APPROVED_FRED_SERIES_IDS } from "./live-adapters";
import { isRestrictedIceSource, permittedLedgerSources } from "./provider-policy";
import { LEDGER_SOURCE_REGISTRY } from "./source-registry";

describe("Ledger provider policy", () => {
  it("removes every ICE/BofA series from the active automation registry", () => {
    const registry = JSON.stringify(LEDGER_SOURCE_REGISTRY);
    assert.doesNotMatch(registry, /BAMLH0A0HYM2|BAMLC0A0CM|ICE BofA|St\. Louis Fed \/ ICE/i);
    assert.equal(LEDGER_SOURCE_REGISTRY.some(isRestrictedIceSource), false);
  });

  it("permits only fixed STLFSI4 use for FRED automation", () => {
    const fredSources = LEDGER_SOURCE_REGISTRY.filter((source) => source.credentialEnv === "FRED_API_KEY");
    assert.ok(fredSources.length > 0);
    assert.ok(fredSources.every((source) => source.liveProvider === "FRED_FINANCIAL_STRESS"));
    assert.deepEqual(APPROVED_FRED_SERIES_IDS, ["STLFSI4"]);
  });

  it("filters restricted observations from public current-source rendering", () => {
    const sources = [
      { institution: "St. Louis Fed / ICE", title: "ICE BofA spread", url: "https://fred.stlouisfed.org/data/BAMLH0A0HYM2" },
      { institution: "St. Louis Fed", title: "Financial Stress Index", url: "https://fred.stlouisfed.org/series/STLFSI4" },
    ];
    assert.deepEqual(permittedLedgerSources(sources), [sources[1]]);
  });

  it("keeps the October 10 formal publication and Financial Buffer methodology unchanged", () => {
    assert.equal(OCTOBER_10_LEDGER_COMMIT, "b8964469701d85fb17a8995784ffe282e09c6d36");
    assert.equal(OCTOBER_10_LEDGER_PUBLICATION.publicationDate, "October 10, 2026");
    assert.equal(OCTOBER_10_LEDGER_PUBLICATION.overall.temperature, 74);
    assert.equal(OCTOBER_10_LEDGER_PUBLICATION.overall.qualitativeState, "High");
    assert.equal(OCTOBER_10_LEDGER_PUBLICATION.overall.systemicDirection, "Systems Functioning");
    assert.equal(OCTOBER_10_LEDGER_PUBLICATION.overall.confidence, "moderate");

    const financial = BUFFER_HEALTH_DOMAINS.find((domain) => domain.id === "financial-system");
    assert.ok(financial);
    assert.equal(financial.reserveState, "Healthy");
    assert.ok(financial.escalationCriteria.includes(
      "Corporate spreads widen persistently and financial-stress indexes rise above normal",
    ));
  });
});
