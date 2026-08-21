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
      "shape=hexagon&carat=abc&ringSize=99&bandWidth=9&skinTone=blue&orientation=diagonal&metal=platinum",
    );
    assert.deepEqual(invalid.state, DIAMOND_STUDIO_URL_DEFAULTS);
    assert.equal(invalid.loadedFromUrl, false);
  });

  it("parses and clamps valid configuration values", () => {
    const parsed = parseStudioSearchParams(
      "?shape=oval&carat=2&ringSize=6.5&bandWidth=2&skinTone=medium&orientation=ew&metal=white-gold",
    );
    assert.equal(parsed.loadedFromUrl, true);
    assert.deepEqual(parsed.state, {
      shape: "oval",
      carat: 2,
      ringSize: 6.5,
      bandWidth: 2,
      skinTone: "medium",
      orientation: "ew",
      metal: "white-gold",
    });
  });

  it("accepts metal aliases and ignores unknown metal without dropping other params", () => {
    assert.equal(parseStudioSearchParams("metal=rose").state.metal, "rose-gold");
    assert.equal(parseStudioSearchParams("metal=white").state.metal, "white-gold");
    assert.equal(parseStudioSearchParams("metal=yellow").state.metal, "yellow-gold");
    const mixed = parseStudioSearchParams("shape=oval&metal=platinum");
    assert.equal(mixed.state.shape, "oval");
    assert.equal(mixed.state.metal, "yellow-gold");
    assert.equal(mixed.loadedFromUrl, true);
    assert.equal(parseStudioSearchParams("metal=yg").state.metal, "yellow-gold");
    assert.equal(parseStudioSearchParams("metal=wg").state.metal, "yellow-gold");
    assert.equal(parseStudioSearchParams("metal=rg").state.metal, "yellow-gold");
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
    assert.equal(DIAMOND_STUDIO_URL_DEFAULTS.bandWidth, 2);
    assert.equal(
      serializeStudioSearchParams({
        ...DIAMOND_STUDIO_URL_DEFAULTS,
        shape: "oval",
        carat: 2,
        ringSize: 6,
        orientation: "ns",
      }),
      "shape=oval&carat=2",
    );
    assert.equal(
      serializeStudioSearchParams({
        ...DIAMOND_STUDIO_URL_DEFAULTS,
        bandWidth: 2.5,
      }),
      "bandWidth=2.5",
    );
    assert.equal(
      serializeStudioSearchParams({
        ...DIAMOND_STUDIO_URL_DEFAULTS,
        metal: "rose-gold",
      }),
      "metal=rose-gold",
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
    assert.equal(
      buildStudioSharePath({
        ...DIAMOND_STUDIO_URL_DEFAULTS,
        metal: "white-gold",
      }),
      "/diamond-studio?metal=white-gold",
    );
    assert.equal(
      buildStudioSharePath({
        ...DIAMOND_STUDIO_URL_DEFAULTS,
        metal: "white-gold",
        bandWidth: 2.5,
      }),
      "/diamond-studio?bandWidth=2.5&metal=white-gold",
    );
  });

  it("keeps explicit historical bandWidth=2.5 instead of the new 2.0 default", () => {
    const parsed = parseStudioSearchParams("bandWidth=2.5");
    assert.equal(parsed.state.bandWidth, 2.5);
    assert.equal(parsed.loadedFromUrl, true);
    assert.equal(parseStudioSearchParams("").state.bandWidth, 2);
    assert.equal(
      parseStudioSearchParams("metal=white-gold").state.bandWidth,
      2,
    );
    assert.deepEqual(
      parseStudioSearchParams("metal=white-gold&bandWidth=2.5").state,
      {
        ...DIAMOND_STUDIO_URL_DEFAULTS,
        metal: "white-gold",
        bandWidth: 2.5,
      },
    );
  });
});
