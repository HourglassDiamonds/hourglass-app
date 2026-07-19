import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const page = readFileSync(join(root, "app/diamond-studio/page.tsx"), "utf8");

describe("Size Studio slider keyboard accessibility (WCAG 2.1.1)", () => {
  it("keyboard handling is attached as a native listener on the track element", () => {
    assert.match(page, /function attachSliderKeyboard\(/);
    assert.match(page, /track\.addEventListener\("keydown", onKeyDown\)/);
    assert.match(page, /track\.removeEventListener\("keydown", onKeyDown\)/);
  });

  it("handled keys call preventDefault so the page does not scroll", () => {
    const attachBlock = page.slice(
      page.indexOf("function attachSliderKeyboard"),
      page.indexOf("export default function DiamondStudioPage"),
    );
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]) {
      assert.match(attachBlock, new RegExp(`case "${key}":`));
    }
    const preventDefaultCount = (attachBlock.match(/e\.preventDefault\(\)/g) ?? [])
      .length;
    assert.ok(
      preventDefaultCount >= 4,
      `expected preventDefault in each key branch, found ${preventDefaultCount}`,
    );
  });

  it("all three sliders wire keyboard handlers to their existing apply functions", () => {
    const callSites = page.match(/attachSliderKeyboard\(el, \{/g) ?? [];
    assert.equal(callSites.length, 3, "ring size, band width, and carat tracks");
    assert.match(page, /decrease: \(\) => applyRingSize\(ringSizeRef\.current - 0\.5, true\)/);
    assert.match(page, /increase: \(\) => applyCarat\(caratRef\.current \+ CARAT_STEP, true\)/);
    assert.match(page, /home: \(\) => applyBandWidth\(0, true\)/);
    assert.match(page, /end: \(\) => applyBandWidth\(BAND_WIDTH_VALUES\.length - 1, true\)/);
  });

  it("tracks expose slider semantics and stay focusable", () => {
    // JSX only (a doc comment also mentions role="slider")
    const sliderRoles = page.match(/\n\s+role="slider"/g) ?? [];
    assert.equal(sliderRoles.length, 3);
    const tabbable = page.match(/className="dts-track"[\s\S]{0,220}?tabIndex=\{0\}/g) ?? [];
    assert.equal(tabbable.length, 3);
    for (const label of ['"Ring size"', '"Band width"', '"Diamond weight"']) {
      assert.ok(page.includes(`aria-label=${label}`), `missing aria-label=${label}`);
    }
    assert.match(page, /aria-valuetext=\{`US ring size \$\{ringSize\.toFixed\(1\)\}`\}/);
    assert.match(page, /aria-valuetext=\{`\$\{carat\.toFixed\(2\)\} carats`\}/);
    assert.match(page, /aria-valuetext=\{`\$\{bandWidth\} millimeter band`\}/);
  });

  it("keyboard focus on the track has a visible focus treatment", () => {
    assert.match(
      page,
      /\.dts-slider \.dts-track:focus-visible\{[^}]*outline:2px solid var\(--hg-focus-ring/,
    );
  });
});
