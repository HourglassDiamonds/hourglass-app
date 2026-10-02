import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const component = readFileSync(
  join(process.cwd(), "app", "executive-dashboard", "concierge", "components", "quick-capture.tsx"),
  "utf8",
);

describe("Quick Capture voice integration", () => {
  it("records, stops, cancels, and releases microphone resources", () => {
    assert.match(component, /getUserMedia\(\{ audio: true \}\)/);
    assert.match(component, /new MediaRecorder/);
    assert.match(component, /stopRecording\(false\)/);
    assert.match(component, /stopRecording\(true\)/);
    assert.match(component, /getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
    assert.match(component, /Recording cancelled\. Nothing was uploaded or saved\./);
  });

  it("handles unsupported, denied, and failed transcription states", () => {
    assert.match(component, /Voice capture isn’t supported/);
    assert.match(component, /Microphone access was denied/);
    assert.match(component, /couldn’t transcribe that recording/);
  });

  it("places a successful transcript into the existing reviewed capture path", () => {
    assert.match(component, /replaceCaptureInput\(result\.text\.trim\(\), "voice"\)/);
    assert.match(component, /provenance,/);
    assert.match(component, /Save selected/);
    assert.doesNotMatch(component, /saveAction\([^)]*result\.text/);
  });

  it("invalidates stale text and proposals across voice and manual input changes", () => {
    assert.match(component, /inputRevisionRef\.current \+= 1/);
    assert.match(component, /replaceCaptureInput\("", "voice"\)/);
    assert.ok(
      component.indexOf('replaceCaptureInput("", "voice")') <
        component.indexOf("getUserMedia({ audio: true })"),
    );
    assert.match(component, /replaceCaptureInput\(event\.target\.value, "text"\)/);
    assert.match(component, /if \(inputRevisionRef\.current !== requestRevision\) return/);
    assert.match(component, /cache: "no-store"/);
    assert.match(component, /voicePhase === "recording" \|\| voicePhase === "transcribing"/);
  });
});
