import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  bandForDegrees,
  channelContribution,
  computeTemperatureDegrees,
  computeWeightedTemperature,
  PRESSURE_MIDPOINTS,
  publishTemperatureReading,
  SYSTEM_TEMPERATURE_READING,
  SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12,
  TEMPERATURE_BANDS,
  TEMPERATURE_CHANNEL_WEIGHTS,
  TRANSMISSION_CAPS,
  assertWeightsSumToOne,
} from "./index";
import {
  evaluateFixture,
  FIXTURE_CRISIS_2008_CLASS,
  FIXTURE_ELEVATED_FUNCTIONING,
  FIXTURE_EXTREME_GEO_CONTAINED,
  FIXTURE_MARCH_2020_CLASS,
  FIXTURE_MULTI_SYSTEM_STRESS,
  FIXTURE_ORDINARY_FUNCTIONING,
} from "./fixtures";
import type { ChannelAssessment, SystemTemperatureSnapshot } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const ledgerRoot = path.resolve(here, "..");

function readLedger(rel: string): string {
  return readFileSync(path.join(ledgerRoot, rel), "utf8");
}

describe("System Temperature bands", () => {
  const boundaries: Array<[number, string]> = [
    [24, "Abnormally Cool"],
    [25, "Calm"],
    [44, "Calm"],
    [45, "Normal"],
    [54, "Normal"],
    [55, "Elevated"],
    [64, "Elevated"],
    [65, "High"],
    [74, "High"],
    [75, "Very High"],
    [84, "Very High"],
    [85, "Severe"],
    [94, "Severe"],
    [95, "Critical"],
    [100, "Critical"],
  ];

  for (const [degrees, label] of boundaries) {
    it(`maps ${degrees}° to ${label}`, () => {
      assert.equal(bandForDegrees(degrees).label, label);
    });
  }

  it("exposes all eight public ranges", () => {
    assert.equal(TEMPERATURE_BANDS.length, 8);
    assert.match(TEMPERATURE_BANDS[7]!.summary, /systemic dysfunction/i);
  });
});

describe("System Temperature methodology", () => {
  it("weights sum to 1", () => {
    assertWeightsSumToOne();
    const sum = Object.values(TEMPERATURE_CHANNEL_WEIGHTS).reduce(
      (total, weight) => total + weight,
      0,
    );
    assert.equal(Number(sum.toFixed(10)), 1);
  });

  it("does not let confidence enter degree calculation", () => {
    const base = SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12;
    const low: SystemTemperatureSnapshot = {
      ...base,
      confidence: "low",
      confidenceRationale: "Clarity deteriorated further.",
    };
    const high: SystemTemperatureSnapshot = {
      ...base,
      confidence: "high",
      confidenceRationale: "Clarity improved.",
    };
    assert.equal(computeTemperatureDegrees(low), computeTemperatureDegrees(high));
  });

  it("caps extreme geopolitics with contained transmission", () => {
    const { reading } = evaluateFixture(FIXTURE_EXTREME_GEO_CONTAINED);
    assert.ok(reading.degrees < 85);
    assert.notEqual(reading.band, "critical");
    assert.equal(
      channelContribution({
        id: "geopolitics-energy-supply",
        pressure: "critical",
        transmission: "contained",
        transmissionExplanation: "x",
        coolingNotes: "y",
      }),
      TRANSMISSION_CAPS.contained,
    );
  });

  it("prevents one extreme channel from creating a systemic reading alone", () => {
    const channels: ChannelAssessment[] = [
      {
        id: "geopolitics-energy-supply",
        pressure: "critical",
        transmission: "partial",
        transmissionExplanation: "Extreme corridor stress.",
        coolingNotes: "Others normal.",
        materialChange: true,
      },
      {
        id: "financial-economic",
        pressure: "normal",
        transmission: "contained",
        transmissionExplanation: "Credit calm.",
        coolingNotes: "No stress.",
      },
      {
        id: "physical-infrastructure",
        pressure: "normal",
        transmission: "contained",
        transmissionExplanation: "Grid ordinary.",
        coolingNotes: "Flexible.",
      },
      {
        id: "commodities-materials",
        pressure: "normal",
        transmission: "contained",
        transmissionExplanation: "Materials ordinary.",
        coolingNotes: "Stable.",
      },
      {
        id: "technology-ai",
        pressure: "normal",
        transmission: "contained",
        transmissionExplanation: "AI ordinary.",
        coolingNotes: "Stable.",
      },
    ];
    const degrees = Math.round(computeWeightedTemperature(channels));
    assert.ok(degrees < 85);
  });

  it("does not ratchet unresolved risk without material change", () => {
    const prior = SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12.channels;
    const unchanged: SystemTemperatureSnapshot = {
      ...SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12,
      isBaselineReading: false,
      reviewDate: "August 19, 2026",
      channels: prior.map((channel) => ({
        ...channel,
        materialChange: false,
        transmissionExplanation: "",
      })),
      explanation: "No material change.",
    };
    const reading = publishTemperatureReading(unchanged, {
      isBaseline: false,
      previousDegrees: SYSTEM_TEMPERATURE_READING.degrees,
    });
    // Same inputs → same degrees, and upward-move validators would fire if delta > 0
    assert.equal(reading.degrees, SYSTEM_TEMPERATURE_READING.degrees);
    assert.equal(reading.weeklyDelta, 0);
  });

  it("supports legitimate cooling as a negative move", () => {
    const cooledChannels: ChannelAssessment[] =
      SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12.channels.map((channel) =>
        channel.id === "geopolitics-energy-supply"
          ? {
              ...channel,
              pressure: "high",
              transmission: "contained",
              materialChange: true,
              transmissionExplanation: "Corridor transit normalized materially.",
              coolingNotes: "Energy premium faded.",
            }
          : channel,
      );
    const cooled: SystemTemperatureSnapshot = {
      ...SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12,
      isBaselineReading: false,
      channels: cooledChannels,
      pressureLabel: "Elevated Pressure",
      explanation: "Corridor heat cooled with contained transmission.",
      coolingReview: {
        improved: "Hormuz transit recovered toward normal.",
        normalized: "Oil premium faded.",
        failedToTransmit: "Credit never seized.",
        absorbed: "Markets absorbed the prior shock.",
        decayed: "Acute attack cluster decayed.",
      },
    };
    const reading = publishTemperatureReading(cooled, {
      isBaseline: false,
      previousDegrees: SYSTEM_TEMPERATURE_READING.degrees,
    });
    assert.ok((reading.weeklyDelta ?? 0) < 0);
    assert.equal(reading.validation.ok, true);
  });

  it("requires regime validation for moves greater than 5°", () => {
    const spiked: SystemTemperatureSnapshot = {
      ...SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12,
      isBaselineReading: false,
      editorialOverrideDegrees: {
        degrees: SYSTEM_TEMPERATURE_READING.degrees + 8,
        reason: "Attempted unsupported jump",
      },
      channels: SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12.channels.map((channel) => ({
        ...channel,
        materialChange: false,
      })),
    };
    const reading = publishTemperatureReading(spiked, {
      isBaseline: false,
      previousDegrees: SYSTEM_TEMPERATURE_READING.degrees,
    });
    assert.equal(reading.validation.ok, false);
    assert.ok(
      reading.validation.issues.some((issue) => issue.code === "regime-move"),
    );
  });

  it("requires broad/systemic transmission for 90°+", () => {
    const attempt: SystemTemperatureSnapshot = {
      ...SYSTEM_TEMPERATURE_SNAPSHOT_2026_08_12,
      editorialOverrideDegrees: {
        degrees: 91,
        reason: "Forced high reading without transmission",
      },
    };
    const reading = publishTemperatureReading(attempt, { isBaseline: true });
    assert.equal(reading.validation.ok, false);
    assert.ok(
      reading.validation.issues.some(
        (issue) => issue.code === "ninety-plus-transmission",
      ),
    );
  });

  it("requires systemic dysfunction for 95°+", () => {
    const attempt: SystemTemperatureSnapshot = {
      ...FIXTURE_MARCH_2020_CLASS,
      editorialOverrideDegrees: {
        degrees: 96,
        reason: "Forced critical without dysfunction flag everywhere",
      },
      channels: FIXTURE_MARCH_2020_CLASS.channels.map((channel) =>
        channel.transmission === "systemic-dysfunction"
          ? { ...channel, transmission: "broad" }
          : channel,
      ),
    };
    const reading = publishTemperatureReading(attempt, { isBaseline: true });
    assert.equal(reading.validation.ok, false);
    assert.ok(
      reading.validation.issues.some(
        (issue) => issue.code === "ninety-five-plus-dysfunction",
      ),
    );
  });
});

describe("Historical calibration fixtures", () => {
  it("places ordinary functioning near 45–55°", () => {
    const { reading } = evaluateFixture(FIXTURE_ORDINARY_FUNCTIONING);
    assert.ok(reading.degrees >= 45 && reading.degrees <= 55);
    assert.equal(reading.validation.ok, true);
  });

  it("places elevated-but-functioning near 55–70°", () => {
    const { reading } = evaluateFixture(FIXTURE_ELEVATED_FUNCTIONING);
    assert.ok(reading.degrees >= 55 && reading.degrees <= 70);
    assert.equal(reading.validation.ok, true);
  });

  it("places multi-system stress near 70–85°", () => {
    const { reading } = evaluateFixture(FIXTURE_MULTI_SYSTEM_STRESS);
    assert.ok(reading.degrees >= 70 && reading.degrees <= 85);
    assert.equal(reading.validation.ok, true);
  });

  it("places March 2020-class in severe territory", () => {
    const { reading } = evaluateFixture(FIXTURE_MARCH_2020_CLASS);
    assert.ok(reading.degrees >= 85 && reading.degrees <= 94);
    assert.equal(reading.band, "severe");
    assert.equal(reading.validation.ok, true);
  });

  it("places 2008-class in critical territory", () => {
    const { reading } = evaluateFixture(FIXTURE_CRISIS_2008_CLASS);
    assert.ok(reading.degrees >= 95);
    assert.equal(reading.band, "critical");
    assert.equal(reading.validation.ok, true);
  });
});

describe("August 12, 2026 published reading", () => {
  it("publishes a validated baseline without legacy delta", () => {
    assert.equal(SYSTEM_TEMPERATURE_READING.degrees, 66);
    assert.equal(SYSTEM_TEMPERATURE_READING.bandLabel, "High");
    assert.equal(SYSTEM_TEMPERATURE_READING.confidence, "moderate");
    assert.equal(SYSTEM_TEMPERATURE_READING.weeklyDelta, null);
    assert.match(
      SYSTEM_TEMPERATURE_READING.baselineLabel ?? "",
      /Baseline established August 12, 2026/,
    );
    assert.equal(SYSTEM_TEMPERATURE_READING.evidenceCutoff, "August 12, 2026");
    assert.equal(SYSTEM_TEMPERATURE_READING.validation.ok, true);
    assert.ok(SYSTEM_TEMPERATURE_READING.degrees < 90);
  });

  it("uses pressure midpoints and transmission caps as designed", () => {
    assert.equal(PRESSURE_MIDPOINTS.normal, 50);
    assert.equal(TRANSMISSION_CAPS.contained, 64);
    assert.equal(TRANSMISSION_CAPS.partial, 74);
  });
});

describe("Public route wiring", () => {
  it("mounts System Temperature and scale key on /ledger only", () => {
    const hub = readLedger("page.tsx");
    const component = readLedger("components/system-temperature.tsx");
    assert.match(hub, /SystemTemperature/);
    assert.match(component, /data-ledger-system-temperature/);
    assert.match(component, /data-ledger-temperature-scale-key/);
    assert.doesNotMatch(component, /\+[0-9]+°/);
  });

  it("does not mount System Temperature on monitor routes", () => {
    const routes = [
      "global-pressure-index/page.tsx",
      "information-signal-map/page.tsx",
      "ai-capability-acceleration-index/page.tsx",
      "precious-materials-index/page.tsx",
      "infrastructure-strain-index/page.tsx",
    ];
    for (const route of routes) {
      const source = readLedger(route);
      assert.doesNotMatch(source, /SystemTemperature|system-temperature/);
      assert.doesNotMatch(source, /import LedgerIndexMeter/);
    }
    const gpmData = readLedger("global-pressure-monitor-data.ts");
    assert.doesNotMatch(gpmData, /System Temperature/);
  });

  it("keeps numerical meter out of public page content path", () => {
    const pageContent = readLedger("components/ledger-index-page.tsx");
    assert.doesNotMatch(pageContent, /import LedgerIndexMeter/);
    assert.match(pageContent, /no longer renders numerical meters/);
  });
});

describe("Hub / monitor status sync", () => {
  it("keeps evidence cutoff at August 12, 2026", async () => {
    const { LEDGER_EVIDENCE_CUTOFF } = await import("../ledger-monitor-framework");
    assert.equal(LEDGER_EVIDENCE_CUTOFF, "August 12, 2026");
  });

  it("syncs hub statuses with monitor snapshot states", async () => {
    const { getLedgerIndex } = await import("../ledger-data");
    const { GPM_CURRENT_STATE } = await import("../global-pressure-monitor-data");
    const { ISM_CURRENT_STATE } = await import("../information-signal-map-data");
    const { ACAI_SNAPSHOT } = await import("../ai-capability-acceleration-data");
    const { PMI_SNAPSHOT } = await import("../precious-materials-data");
    const { ISI_SNAPSHOT } = await import("../infrastructure-strain-data");

    assert.equal(getLedgerIndex("global-pressure").status, GPM_CURRENT_STATE);
    assert.equal(getLedgerIndex("information-signal").status, ISM_CURRENT_STATE);
    assert.equal(getLedgerIndex("ai-capability").status, ACAI_SNAPSHOT.currentState);
    assert.equal(getLedgerIndex("precious-materials").status, PMI_SNAPSHOT.currentState);
    assert.equal(
      getLedgerIndex("infrastructure-strain").status,
      ISI_SNAPSHOT.currentState,
    );
  });
});
