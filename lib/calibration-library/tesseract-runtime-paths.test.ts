import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  describeTesseractRuntimePaths,
  resolveTesseractRuntimePaths,
  tesseractWorkerCreateOptions,
} from "./tesseract-runtime-paths";

describe("resolveTesseractRuntimePaths", () => {
  it("resolves bundled worker, core, and eng lang paths", () => {
    const paths = resolveTesseractRuntimePaths();
    assert.equal(existsSync(paths.workerPath), true);
    assert.equal(existsSync(paths.corePath), true);
    assert.equal(
      existsSync(join(paths.langPath, "eng.traineddata.gz")),
      true,
    );
    assert.match(paths.cachePath, /hourglass-tesseract-cache$/);
  });

  it("tesseractWorkerCreateOptions includes bundled lang path", () => {
    const opts = tesseractWorkerCreateOptions();
    assert.equal(typeof opts.langPath, "string");
    assert.equal(typeof opts.cachePath, "string");
    assert.equal("workerPath" in opts, false);
  });

  it("describeTesseractRuntimePaths does not throw", () => {
    const described = describeTesseractRuntimePaths();
    assert.equal(typeof described.workerPath, "string");
    assert.equal(typeof described.langPath, "string");
  });
});
