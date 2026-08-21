import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const shareSource = readFileSync(
  path.join(
    process.cwd(),
    "app/diamond-studio/components/ShareStudioView.tsx",
  ),
  "utf8",
);
const pageSource = readFileSync(
  path.join(process.cwd(), "app/diamond-studio/page.tsx"),
  "utf8",
);
const analyticsSource = readFileSync(
  path.join(process.cwd(), "app/diamond-studio/analytics.ts"),
  "utf8",
);

describe("Studio share UX", () => {
  it("keeps Share this view as the compact trigger", () => {
    assert.match(shareSource, /Share this view/);
    assert.match(pageSource, /<ShareStudioView/);
    assert.match(pageSource, /configuration=\{\{/);
  });

  it("offers Email this view, Share image, and Copy Studio link", () => {
    assert.match(shareSource, /Email this view/);
    assert.match(
      shareSource,
      /Send the image and configuration to your inbox\./,
    );
    assert.match(shareSource, /Copy Studio link/);
    assert.match(shareSource, /Share image/);
    assert.match(shareSource, /type="email"/);
    assert.match(shareSource, /inputMode="email"/);
    assert.match(shareSource, /navigator\.share/);
    assert.match(shareSource, /canShare/);
    assert.match(shareSource, /triggerDownload/);
    assert.doesNotMatch(shareSource, /Save snapshot/);
  });

  it("shares only the branded card and never a clean finger image", () => {
    const shareFn = shareSource.slice(
      shareSource.indexOf("const shareImage"),
      shareSource.indexOf("const emailThisView"),
    );
    assert.match(shareFn, /fetchBrandedShareCard\(configuration\)/);
    assert.match(shareSource, /buildSnapshotRequestPath\(configuration, "card"\)/);
    assert.doesNotMatch(shareSource, /"clean"/);
    assert.match(shareSource, /snapshotDownloadFilename\(configuration, "card"\)/);
  });

  it("does not require email for anonymous copy or image share", () => {
    const copyFn = shareSource.slice(
      shareSource.indexOf("const copyStudioLink"),
      shareSource.indexOf("const shareImage"),
    );
    const shareFn = shareSource.slice(
      shareSource.indexOf("const shareImage"),
      shareSource.indexOf("const emailThisView"),
    );
    assert.doesNotMatch(copyFn, /emailThisView/);
    assert.doesNotMatch(copyFn, /\/api\/diamond-studio\/email-view/);
    assert.doesNotMatch(shareFn, /\/api\/diamond-studio\/email-view/);
    assert.match(shareSource, /company_website/);
  });

  it("fires studio_view_emailed only after accepted send, without PII keys", () => {
    assert.match(shareSource, /studio_view_emailed/);
    assert.match(shareSource, /body\.accepted/);
    const gaCall = shareSource.slice(
      shareSource.indexOf('trackDiamondStudioEvent("studio_view_emailed"'),
      shareSource.indexOf("scheduleReset(\"sent\")"),
    );
    assert.doesNotMatch(gaCall, /\bemail\b/);
    assert.doesNotMatch(gaCall, /firstName/);
    assert.match(analyticsSource, /studio_view_emailed/);
  });

  it("does not remove the existing Studio link event", () => {
    assert.match(shareSource, /diamond_studio_share/);
    assert.match(analyticsSource, /studio_snapshot_created/);
    assert.match(analyticsSource, /studio_snapshot_shared/);
    assert.match(analyticsSource, /studio_share_card_created/);
  });

  it("does not add a giant sharing card to the control rail", () => {
    const rail = pageSource.slice(
      pageSource.indexOf('className="dts-control-rail"'),
      pageSource.indexOf('className="dts-stage-stack"'),
    );
    assert.doesNotMatch(rail, /ShareStudioView/);
    assert.doesNotMatch(rail, /Save snapshot/);
  });
});
