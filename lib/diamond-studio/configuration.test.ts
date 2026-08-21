import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
  buildSnapshotRequestPath,
  formatStudioCardCopy,
  parseStudioConfigurationObject,
  parseStudioSnapshotRequest,
  snapshotDownloadFilename,
} from "./configuration";
import { parseStudioSearchParams } from "./url-state";

describe("DiamondStudioConfiguration contract", () => {
  it("uses Phase A URL-state fields including metal (not bandMetal)", () => {
    const defaults = DIAMOND_STUDIO_CONFIGURATION_DEFAULTS;
    assert.equal(defaults.shape, "round");
    assert.equal(defaults.carat, 2.5);
    assert.equal(defaults.ringSize, 6);
    assert.equal(defaults.bandWidth, 2);
    assert.equal(defaults.skinTone, "light");
    assert.equal(defaults.metal, "yellow-gold");
    assert.equal(defaults.orientation, "ns");
    assert.equal("bandMetal" in defaults, false);
  });

  it("accepts White / Rose / 2.0 and 5.0 mm / NS and EW", () => {
    const white = parseStudioSnapshotRequest(
      "shape=round&carat=3&skinTone=medium&metal=white-gold&bandWidth=2.5",
    );
    assert.equal(white.ok, true);
    if (white.ok) {
      assert.equal(white.state.metal, "white-gold");
      assert.equal(white.state.bandWidth, 2.5);
      assert.equal(white.variant, "clean");
    }

    const roseNs = parseStudioSnapshotRequest(
      "shape=oval&carat=2.75&skinTone=light&metal=rose-gold&bandWidth=2&orientation=ns",
    );
    assert.equal(roseNs.ok, true);
    if (roseNs.ok) {
      assert.equal(roseNs.state.orientation, "ns");
      assert.equal(roseNs.state.metal, "rose-gold");
    }

    const roseEw = parseStudioSnapshotRequest(
      "shape=oval&carat=2.75&metal=rose-gold&orientation=ew&variant=card",
    );
    assert.equal(roseEw.ok, true);
    if (roseEw.ok) {
      assert.equal(roseEw.state.orientation, "ew");
      assert.equal(roseEw.variant, "card");
    }

    const wide = parseStudioSnapshotRequest(
      "shape=emerald&carat=4&skinTone=dark&metal=white-gold&bandWidth=5",
    );
    assert.equal(wide.ok, true);
    if (wide.ok) {
      assert.equal(wide.state.bandWidth, 5);
      assert.equal(wide.state.shape, "emerald");
    }
  });

  it("rejects unsupported values and unknown keys", () => {
    const badShape = parseStudioSnapshotRequest("shape=hexagon");
    assert.equal(badShape.ok, false);

    const pathProbe = parseStudioSnapshotRequest(
      "shape=round&src=/etc/passwd",
    );
    assert.equal(pathProbe.ok, false);
    if (!pathProbe.ok) {
      assert.ok(pathProbe.invalidParams.includes("src"));
    }

    const badVariant = parseStudioSnapshotRequest("variant=poster");
    assert.equal(badVariant.ok, false);
  });

  it("formats branded card copy with configuration, not skin tone", () => {
    const copy = formatStudioCardCopy(DIAMOND_STUDIO_CONFIGURATION_DEFAULTS);
    assert.equal(copy.headline, "2.50 ct Round");
    assert.equal(copy.detail, "Size 6 · 2.0 mm Yellow Gold");
    assert.equal(copy.orientationLine, null);
    assert.doesNotMatch(copy.headline + copy.detail, /skin|light|dark|medium/i);

    const ovalEw = formatStudioCardCopy({
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      shape: "oval",
      carat: 2.75,
      metal: "rose-gold",
      orientation: "ew",
    });
    assert.equal(ovalEw.headline, "2.75 ct Oval");
    assert.equal(ovalEw.detail, "Size 6 · 2.0 mm Rose Gold");
    assert.equal(ovalEw.orientationLine, "E/W orientation");
  });

  it("keeps Studio share links independent of snapshot API paths", () => {
    const state = parseStudioSearchParams("metal=white-gold").state;
    assert.equal(
      buildSnapshotRequestPath(state, "clean").startsWith(
        "/api/diamond-studio/snapshot?",
      ),
      true,
    );
    assert.match(snapshotDownloadFilename(state, "card"), /\.jpg$/);
  });

  it("parses configuration objects and rejects unknown properties", () => {
    const ok = parseStudioConfigurationObject(DIAMOND_STUDIO_CONFIGURATION_DEFAULTS);
    assert.equal(ok.ok, true);

    const badShape = parseStudioConfigurationObject({
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      shape: "hexagon",
    });
    assert.equal(badShape.ok, false);

    const extra = parseStudioConfigurationObject({
      ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
      snapshotUrl: "https://evil.example/x.jpg",
    } as unknown as Record<string, unknown>);
    assert.equal(extra.ok, false);
  });
});

describe("live Studio still owns configuration via url-state", () => {
  it("page.tsx does not introduce a second configuration type", () => {
    const page = readFileSync(
      path.join(process.cwd(), "app/diamond-studio/page.tsx"),
      "utf8",
    );
    assert.match(page, /diamondLayerCqw\(/);
    assert.doesNotMatch(page, /type DiamondStudioConfiguration/);
    assert.doesNotMatch(page, /html2canvas/);
  });
});
