import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

function readStudio(rel: string): string {
  return readFileSync(join(root, "app", "diamond-shape-studio", rel), "utf8");
}

function readLib(rel: string): string {
  return readFileSync(join(root, "lib", "shape-studio", rel), "utf8");
}

describe("direct same-device mobile entry contracts", () => {
  const entry = readStudio("components/direct-mobile-entry.tsx");
  const stage = readStudio("components/overlay-stage.tsx");
  const view = readStudio("shape-studio-view.tsx");
  const layout = readStudio("layout.tsx");
  const styles = readStudio("components/shape-studio-styles.tsx");
  const localLib = readLib("local-photo-selection.ts");

  it("narrow mobile entry shows only Take a Photo (no gallery picker)", () => {
    assert.match(entry, /Take a Photo/);
    assert.match(entry, /aria-label="Take a photo"/);
    assert.doesNotMatch(entry, /Choose from Photos/);
    assert.doesNotMatch(entry, /aria-label="Choose from photos"/);
    assert.doesNotMatch(entry, /data-dss-local-input="library"/);
    assert.match(entry, /Using another device\?/);
  });

  it("narrow mobile entry does not present QR as the primary action", () => {
    assert.doesNotMatch(entry, /Capture with phone/);
    assert.doesNotMatch(entry, /QrCapturePanel/);
    assert.match(styles, /\.dss-entry-desktop\{\s*display:flex/);
    assert.match(styles, /\.dss-entry-mobile\{\s*display:none/);
    assert.match(
      styles,
      /@media \(max-width: 960px\)[\s\S]*\.dss-entry-desktop\{\s*display:none/,
    );
    assert.match(
      styles,
      /@media \(max-width: 960px\)[\s\S]*\.dss-entry-mobile\{\s*display:flex/,
    );
  });

  it("desktop entry still shows the QR relay Capture with phone CTA", () => {
    assert.match(stage, /data-dss-entry-desktop/);
    assert.match(stage, /Capture with phone/);
    assert.match(stage, /phoneCapture\.start/);
    assert.match(stage, /QrCapturePanel/);
  });

  it("Take a Photo uses the camera-hinted input as the only local file control", () => {
    assert.match(entry, /data-dss-local-input="camera"/);
    assert.match(
      entry,
      /data-dss-local-input="camera"[\s\S]*capture="environment"/,
    );
    assert.equal(
      (entry.match(/data-dss-local-input=/g) ?? []).length,
      1,
    );
    assert.equal((entry.match(/type="file"/g) ?? []).length, 1);
    assert.match(entry, /accept=\{LOCAL_PHOTO_ACCEPT\}/);
    assert.match(localLib, /LOCAL_PHOTO_ACCEPT = "image\/\*"/);
  });

  it("camera and photo-picker cancellation leave entry intact (no error path)", () => {
    assert.match(entry, /e\.target\.value = ""/);
    assert.match(entry, /if \(result\.reason === "cancelled"\) return/);
    assert.match(localLib, /reason: "cancelled"/);
  });

  it("selected photo enters a local review state with one image", () => {
    assert.match(entry, /data-dss-direct-mobile-review/);
    assert.match(entry, /Use This Photo/);
    assert.match(entry, /Retake/);
    assert.match(entry, /Selected hand-and-card photograph/);
    assert.match(stage, /pendingLocalPhotoUrl/);
    assert.match(stage, /DirectMobileReview/);
    assert.equal(
      (entry.match(/dss-entry-review-img/g) ?? []).length,
      1,
    );
  });

  it("USE THIS PHOTO invokes the existing local image pipeline exactly once", () => {
    assert.match(view, /handleConfirmLocalPhoto/);
    assert.match(
      view,
      /handleImageSelected\(url, "card-reference"\)/,
    );
    const confirm = view.slice(
      view.indexOf("handleConfirmLocalPhoto"),
      view.indexOf("handleRetakeLocalPhoto"),
    );
    assert.equal(
      (confirm.match(/handleImageSelected\(/g) ?? []).length,
      1,
    );
  });

  it("RETAKE clears the pending image and revokes the prior object URL", () => {
    assert.match(view, /handleRetakeLocalPhoto/);
    assert.match(
      view,
      /replacePendingObjectUrl\(prev, null\)/,
    );
    assert.match(localLib, /URL\.revokeObjectURL\(previous\)/);
  });

  it("a second selection replaces the first preview without leaking the prior URL", () => {
    assert.match(
      view,
      /replacePendingObjectUrl\(prev, objectUrl\)/,
    );
    assert.match(
      localLib,
      /previous\?\.startsWith\("blob:"\) && previous !== next/,
    );
  });

  it("same-device mobile selection creates no capture relay session", () => {
    assert.doesNotMatch(entry, /usePhoneCaptureSession/);
    assert.doesNotMatch(entry, /\/api\/shape-studio/);
    assert.doesNotMatch(entry, /createSession|startSession/);
    assert.match(entry, /Does not create a capture relay session/);
    assert.match(
      view,
      /onPendingLocalPhoto=\{[\s\S]*handlePendingLocalPhoto/,
    );
  });

  it("same-device path does not call session upload APIs", () => {
    assert.doesNotMatch(entry, /\/upload/);
    assert.doesNotMatch(entry, /fetch\(/);
    assert.doesNotMatch(localLib, /fetch\(/);
    assert.doesNotMatch(localLib, /\/api\//);
  });

  it("same-device path does not show waiting-for-computer or Photo sent copy", () => {
    assert.doesNotMatch(entry, /Photo sent/i);
    assert.doesNotMatch(entry, /waiting for/i);
    assert.doesNotMatch(entry, /Return to your desktop/i);
    assert.doesNotMatch(entry, /sent to/i);
    assert.match(
      entry,
      /Place a standard-size card beside your hand so we can calibrate the\s+preview accurately/,
    );
  });

  it("Start over clears pending local review as well as the adopted photo", () => {
    const startIdx = view.indexOf("const handleStartOver");
    const startOver = view.slice(
      startIdx,
      view.indexOf("useEffect", startIdx),
    );
    assert.match(startOver, /replacePendingObjectUrl\(prev, null\)/);
    assert.match(startOver, /phoneCapture\.cancel\(\)/);
    assert.match(startOver, /setHandImageUrl/);
  });

  it("card instruction copy remains restrained and non-automatic", () => {
    assert.match(
      entry,
      /Place a standard-size card beside your hand so we can calibrate the\s+preview accurately/,
    );
    assert.doesNotMatch(entry, /automatically detect/i);
    assert.doesNotMatch(entry, /computer vision/i);
    assert.doesNotMatch(entry, /virtual try-on/i);
    assert.doesNotMatch(entry, /ring size/i);
  });

  it("mobile entry reuses the desktop capture hand-and-card instructional asset", () => {
    assert.match(entry, /HandCardCaptureGuide/);
    assert.match(entry, /showCaption=\{false\}/);
    assert.match(
      styles,
      /\.dss-entry-mobile-guide[\s\S]*width:min\(100%, 340px\)/,
    );
    const guide = readStudio("components/hand-card-capture-guide.tsx");
    assert.match(guide, /\/diamond-tech-suite\/see-it-on-hgd\.png/);
    const captureView = readStudio("capture/[sessionId]/capture-view.tsx");
    assert.match(captureView, /HandCardCaptureGuide/);
    assert.doesNotMatch(captureView, /see-it-on-hgd\.png/);
  });

  it("visible H1 aligns with suite nav; layout metadata launches See It On Your Hand", () => {
    assert.match(view, /title="See It On Your Hand"/);
    assert.doesNotMatch(view, /Diamond Hand Preview/);
    assert.match(layout, /See It On Your Hand \| Preview Diamond Shapes/);
    assert.match(layout, /robots:\s*\{[\s\S]*index:\s*true/);
  });

  it("desktop QR showQr conditions remain the existing session phases", () => {
    assert.match(
      stage,
      /phoneCapture!\.phase === "creating" \|\|[\s\S]*phoneCapture!\.phase === "active"/,
    );
    assert.match(stage, /phoneCapture!\.expired/);
  });
});
