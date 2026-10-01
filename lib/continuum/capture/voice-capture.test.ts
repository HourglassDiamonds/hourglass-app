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
    assert.match(component, /setText\(result\.text\.trim\(\)\)/);
    assert.match(component, /setProvenance\("voice"\)/);
    assert.match(component, /provenance,/);
    assert.match(component, /Save selected/);
    assert.doesNotMatch(component, /saveAction\([^)]*result\.text/);
  });
});
