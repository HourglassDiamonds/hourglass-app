import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIAMOND_STUDIO_URL_DEFAULTS,
  buildStudioSharePath,
  parseStudioSearchParams,
  serializeStudioSearchParams,
  snapStudioCarat,
  snapStudioRingSize,
} from "./url-state";

describe("diamond studio url-state", () => {
  it("falls back to defaults for empty and invalid params", () => {
    assert.deepEqual(parseStudioSearchParams("").state, DIAMOND_STUDIO_URL_DEFAULTS);
    assert.equal(parseStudioSearchParams("").loadedFromUrl, false);

    const invalid = parseStudioSearchParams(
      "shape=hexagon&carat=abc&ringSize=99&bandWidth=9&skinTone=blue&orientation=diagonal",
    );
    assert.deepEqual(invalid.state, DIAMOND_STUDIO_URL_DEFAULTS);
    assert.equal(invalid.loadedFromUrl, false);
  });

  it("parses and clamps valid configuration values", () => {
    const parsed = parseStudioSearchParams(
      "?shape=oval&carat=2&ringSize=6.5&bandWidth=2&skinTone=medium&orientation=ew",
    );
    assert.equal(parsed.loadedFromUrl, true);
    assert.deepEqual(parsed.state, {
      shape: "oval",
      carat: 2,
      ringSize: 6.5,
      bandWidth: 2,
      skinTone: "medium",
      orientation: "ew",
    });
  });

  it("accepts orientation aliases and snaps carat/ring size", () => {
    const parsed = parseStudioSearchParams(
      "orientation=north-south&carat=2.13&ringSize=5.2",
    );
    assert.equal(parsed.state.orientation, "ns");
    assert.equal(parsed.state.carat, snapStudioCarat(2.13));
    assert.equal(parsed.state.ringSize, snapStudioRingSize(5.2));
  });

  it("omits defaults from serialized query strings", () => {
    assert.equal(serializeStudioSearchParams(DIAMOND_STUDIO_URL_DEFAULTS), "");
    assert.equal(
      serializeStudioSearchParams({
        ...DIAMOND_STUDIO_URL_DEFAULTS,
        shape: "oval",
        carat: 2,
        ringSize: 6,
        bandWidth: 2,
        orientation: "ns",
      }),
      "shape=oval&carat=2&bandWidth=2",
    );
    assert.equal(
      buildStudioSharePath({
        ...DIAMOND_STUDIO_URL_DEFAULTS,
        shape: "emerald",
        carat: 3,
        ringSize: 7,
      }),
      "/diamond-studio?shape=emerald&carat=3&ringSize=7",
    );
  });
});
