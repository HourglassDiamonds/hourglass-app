import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const directory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(directory, "personal-app.tsx"), "utf8");
const css = readFileSync(join(directory, "..", "personal.module.css"), "utf8");

describe("personal Monday UI contract", () => {
  it("keeps the complete manual nutrition workflow and honest photo fallback", () => {
    for (const field of ["calories", "protein", "carbs", "fat"]) {
      assert.match(source, new RegExp(`name="${field}"`));
    }
    assert.match(source, /Automatic plate estimation is not connected/);
    assert.match(source, /nothing is saved until you press Save/);
  });

  it("exposes all workout logging controls", () => {
    assert.match(source, />RIR</);
    assert.match(source, />Skip</);
    assert.match(source, /> Pain</);
    assert.match(source, /Complete workout & review proposals/);
    assert.match(source, /recentMinimumMisses/);
  });

  it("defines the 390px mobile and keyboard-safety contract", () => {
    assert.match(css, /@media\(max-width:390px\)/);
    assert.match(css, /min-height:44px/);
    assert.match(css, /overflow-x:clip/);
    assert.match(css, /scroll-margin-bottom:45vh/);
  });
});
