import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const pageSource = readFileSync(
  path.join(process.cwd(), "app/diamond-studio/page.tsx"),
  "utf8",
);
const shellSource = readFileSync(
  path.join(
    process.cwd(),
    "app/diamond-studio/components/DiamondStudioSuiteShell.tsx",
  ),
  "utf8",
);

describe("Size Studio desktop control rail page scroll", () => {
  it("does not use internal overflow scrolling on the desktop rail", () => {
    const desktopBlocks = [
      ...pageSource.matchAll(
        /@media \(min-width: 1024px\) \{([\s\S]*?)(?=\n {6}@media|\n {4}`\}\})/g,
      ),
    ].map((m) => m[1] ?? "");
    const railBlocks = desktopBlocks.flatMap((block) =>
      [...block.matchAll(/\.dts-control-rail\{([^}]*)\}/g)].map((m) => m[1] ?? ""),
    );
    assert.ok(railBlocks.length > 0, "desktop control-rail CSS missing");
    for (const rail of railBlocks) {
      assert.doesNotMatch(rail, /overflow-y\s*:\s*auto/);
      assert.doesNotMatch(rail, /overflow-y\s*:\s*scroll/);
      assert.match(rail, /overflow\s*:\s*visible/);
    }
    assert.doesNotMatch(pageSource, /dts-control-rail-overflow-cue/);
    assert.doesNotMatch(pageSource, /dts-control-rail-overflow-chevron/);
    assert.doesNotMatch(pageSource, /updateRailOverflowCue/);
    assert.doesNotMatch(pageSource, /railMoreBelow/);
    assert.doesNotMatch(pageSource, /dts-control-rail-wrap/);
  });

  it("lets the Size Studio workspace size to content instead of locking to the viewport", () => {
    assert.match(
      pageSource,
      /@media \(min-width: 1024px\) \{[\s\S]*?\.dts-app\{[\s\S]*?height:auto;[\s\S]*?overflow:visible/,
    );
    assert.doesNotMatch(
      pageSource,
      /\.dts-app\{[\s\S]*?height:\s*var\(--dts-workspace-h/,
    );
    // Shell may still lock Shape Studio (.dss-app), but not Size Studio (.dts-app).
    assert.match(
      shellSource,
      /\[data-suite-instrument\] \.dss-app \{[\s\S]*?overflow: hidden/,
    );
    assert.doesNotMatch(
      shellSource,
      /\[data-suite-instrument\] \.dts-app/,
    );
  });

  it("preserves short-viewport compression and mobile document flow", () => {
    assert.match(
      pageSource,
      /@media \(min-width: 1024px\) and \(max-height: 900px\)/,
    );
    assert.match(
      pageSource,
      /@media \(min-width: 1024px\) and \(max-height: 800px\)/,
    );
    assert.match(
      pageSource,
      /@media \(max-width: 1023px\)[\s\S]*?\.dts-control-rail\{\s*display:contents/,
    );
  });

  it("sizes the laptop finger viewer as a tall portrait stage, not a shallow banner", () => {
    assert.match(
      pageSource,
      /@media \(min-width: 1024px\) and \(max-height: 860px\)[\s\S]*?\.dts-viewer\{[\s\S]*?max-height:min\(72vh, 580px\)/,
    );
    assert.match(
      pageSource,
      /@media \(min-width: 1024px\) and \(max-height: 720px\)[\s\S]*?\.dts-viewer\{[\s\S]*?max-height:min\(70vh, 520px\)/,
    );
    assert.doesNotMatch(
      pageSource,
      /max-height:min\(44vh, 400px\)/,
    );
    assert.doesNotMatch(
      pageSource,
      /max-height:min\(46vh, 400px\)/,
    );
    assert.match(
      pageSource,
      /@media \(min-width: 1024px\) and \(max-height: 960px\)[\s\S]*?\.dts-stage-stack \.dts-stage-preview\{[\s\S]*?flex:0 1 auto/,
    );
  });
});
