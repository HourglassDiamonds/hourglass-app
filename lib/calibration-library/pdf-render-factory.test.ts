import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPdfJsNodeCanvasModule,
  getPdfJsResolvedCanvasModule,
  resolvePdfJsCanvasModulePathForDiagnostics,
} from "./pdf-render-factory";

describe("pdf-render-factory canvas resolution", () => {
  it("getPdfJsResolvedCanvasModule returns a canvas package with createCanvas", () => {
    const pkg = getPdfJsResolvedCanvasModule();
    assert.equal(typeof pkg.createCanvas, "function");
  });

  it("resolvePdfJsCanvasModulePathForDiagnostics does not throw", () => {
    const path = resolvePdfJsCanvasModulePathForDiagnostics();
    assert.ok(path.length > 0);
  });

  it("getPdfJsNodeCanvasModule matches root @napi-rs/canvas", () => {
    const pkg = getPdfJsNodeCanvasModule();
    assert.equal(typeof pkg.createCanvas, "function");
  });
});
