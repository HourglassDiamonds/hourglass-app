import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchGellerCatalog } from "./catalog";

describe("Geller founder search", () => {
  it("treats an exact SKU as a unique source choice", () => {
    const result = searchGellerCatalog("1008");
    assert.equal(result.unique, true);
    assert.equal(result.exactSku, true);
    assert.equal(result.hits.length, 1);
    assert.equal(result.hits[0]?.sku, "1008");
  });

  it("ranks 14k yellow size-up narrow 0-4 without silently choosing", () => {
    const result = searchGellerCatalog("14k yellow size up 1 narrow 0-4 stones");
    assert.equal(result.exactSku, false);
    assert.equal(result.unique, false);
    assert.ok(result.hits.length > 1);
    assert.equal(result.hits[0]?.sku, "1008");
    assert.match(result.hits[0]?.taskDescription ?? "", /Larger/);
  });

  it("returns multiple white-gold head replacement candidates", () => {
    const result = searchGellerCatalog("white gold head replacement");
    assert.equal(result.unique, false);
    assert.ok(result.hits.length > 1);
    assert.ok(result.hits.some((hit) => /head|bezel|prong/i.test(hit.taskDescription)));
  });

  it("returns multiple laser platinum candidates", () => {
    const result = searchGellerCatalog("laser platinum");
    assert.equal(result.unique, false);
    assert.ok(result.hits.length > 1);
    assert.ok(result.hits.every((hit) => /laser/i.test(hit.taskDescription)));
    assert.ok(result.hits.every((hit) => /platinum/i.test(hit.taskDescription)));
  });

  it("returns multiple reset center-stone candidates", () => {
    const result = searchGellerCatalog("reset center stone");
    assert.equal(result.unique, false);
    assert.ok(result.hits.length > 1);
  });

  it("does not treat size-down 5-20 as SKU 1000", () => {
    const result = searchGellerCatalog("size down 14k 5-20 stones");
    assert.equal(result.unique, false);
    assert.notEqual(result.hits[0]?.sku, "1000");
    assert.ok(result.hits[0]?.taskDescription.toLowerCase().includes("smaller"));
  });
});
