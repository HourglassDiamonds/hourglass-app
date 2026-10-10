import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BUFFER_HEALTH_DOMAINS,
  BUFFER_HEALTH_GUARDRAILS,
  BUFFER_HEALTH_SNAPSHOT,
  SYSTEMS_FUNCTIONING_BUFFER_QUALIFIER,
  reserveFillPercent,
} from "./buffer-health-data";
import BufferHealthView, {
  BufferHealthVisual,
} from "./components/buffer-health-view";
import SystemTemperature from "./components/system-temperature";
import {
  computeTemperatureDegrees,
  SYSTEM_TEMPERATURE_READING,
  SYSTEM_TEMPERATURE_SNAPSHOT_2026_09_16,
  TEMPERATURE_CHANNEL_WEIGHTS,
} from "./system-temperature";

const ledgerRoot = path.resolve(process.cwd(), "app", "ledger");

describe("Buffer Health", () => {
  it("renders all six domains on the hub visual", () => {
    const html = renderToStaticMarkup(
      createElement(BufferHealthVisual, { compact: true }),
    );
    assert.equal(BUFFER_HEALTH_DOMAINS.length, 6);
    for (const domain of BUFFER_HEALTH_DOMAINS) {
      assert.match(html, new RegExp(`data-buffer-domain="${domain.id}"`));
      assert.match(html, new RegExp(domain.label));
    }
  });

  it("renders the six October states exactly as approved", () => {
    assert.deepEqual(
      Object.fromEntries(
        BUFFER_HEALTH_DOMAINS.map((domain) => [domain.id, domain.reserveState]),
      ),
      {
        households: "Thinning",
        labor: "Thinning",
        food: "Thinning",
        energy: "Low",
        grid: "Thinning",
        "financial-system": "Healthy",
      },
    );
    assert.equal(
      BUFFER_HEALTH_DOMAINS.some(
        (domain) => domain.reserveState === "Unassessed",
      ),
      false,
    );

    assert.equal(reserveFillPercent("Unassessed"), null);
    const html = renderToStaticMarkup(
      createElement(BufferHealthVisual, { compact: true }),
    );
    assert.match(html, /data-buffer-domain="energy" data-reserve-state="Low" aria-label="Energy buffer health: Low"/);
    assert.match(html, /data-buffer-domain="households" data-reserve-state="Thinning"/);
    assert.match(html, /data-buffer-domain="labor" data-reserve-state="Thinning"/);
    assert.doesNotMatch(html, /Awaiting sourced baseline/);
  });

  it("has no temperature weight or automatic degree conversion", () => {
    assert.equal(BUFFER_HEALTH_GUARDRAILS.systemTemperatureWeight, null);
    assert.equal(BUFFER_HEALTH_GUARDRAILS.automaticDegreeConversion, false);
    assert.equal(BUFFER_HEALTH_GUARDRAILS.mayInformFunctioningReview, true);
    assert.ok(!("buffer-health" in TEMPERATURE_CHANNEL_WEIGHTS));
    const before = computeTemperatureDegrees(
      SYSTEM_TEMPERATURE_SNAPSHOT_2026_09_16,
    );
    const hypotheticalBufferChange = BUFFER_HEALTH_DOMAINS.map((domain) => ({
      ...domain,
      reserveState: "Critical" as const,
    }));
    assert.equal(hypotheticalBufferChange.length, 6);
    assert.equal(
      computeTemperatureDegrees(SYSTEM_TEMPERATURE_SNAPSHOT_2026_09_16),
      before,
    );
    assert.equal(SYSTEM_TEMPERATURE_READING.degrees, 74);
    assert.equal(SYSTEM_TEMPERATURE_READING.bandLabel, "High");
    assert.equal(SYSTEM_TEMPERATURE_READING.functioningLabel, "Systems Functioning");
    assert.equal(SYSTEM_TEMPERATURE_READING.confidence, "moderate");
  });

  it("updates the functioning qualifier independently of temperature", () => {
    const before = computeTemperatureDegrees(
      SYSTEM_TEMPERATURE_SNAPSHOT_2026_09_16,
    );
    const html = renderToStaticMarkup(createElement(SystemTemperature));
    assert.match(html, /data-systems-functioning-qualifier="true"/);
    assert.match(html, new RegExp(SYSTEMS_FUNCTIONING_BUFFER_QUALIFIER));
    assert.equal(
      computeTemperatureDegrees(SYSTEM_TEMPERATURE_SNAPSHOT_2026_09_16),
      before,
    );
    assert.equal(SYSTEM_TEMPERATURE_READING.functioningLabel, "Systems Functioning");
  });

  it("preserves evidence labels and sourced domain details", () => {
    const labels = new Set(
      BUFFER_HEALTH_DOMAINS.flatMap((domain) =>
        domain.sources.map((source) => source.evidenceLabel),
      ),
    );
    assert.deepEqual(
      [...labels].sort(),
      ["Estimated", "Forecast", "Lagged", "Observed", "Provisional"],
    );
    for (const domain of BUFFER_HEALTH_DOMAINS) {
      assert.ok(domain.sources.length > 0);
      assert.ok(domain.rationale.length > 0, `${domain.label} should have a rationale`);
      assert.ok(domain.escalationCriteria.length > 0);
      assert.ok(domain.easingCriteria.length > 0);
      assert.equal(domain.lastUpdated, "October 10, 2026");
      for (const source of domain.sources) {
        assert.ok(source.dataPeriod.length > 0);
      }
    }
    assert.equal(BUFFER_HEALTH_SNAPSHOT.evidenceCutoff, "October 10, 2026");
    const html = renderToStaticMarkup(createElement(BufferHealthView));
    assert.match(html, /October 1 remains the fixed baseline/i);
    for (const label of labels) {
      assert.match(html, new RegExp(label));
    }
  });

  it("is present on the hub and dedicated route", () => {
    const hub = readFileSync(path.join(ledgerRoot, "page.tsx"), "utf8");
    const route = readFileSync(
      path.join(ledgerRoot, "buffer-health", "page.tsx"),
      "utf8",
    );
    assert.match(hub, /<BufferHealthVisual compact/);
    assert.match(route, /<BufferHealthView/);
  });
});
