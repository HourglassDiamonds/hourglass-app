import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractOrderIdentifiers,
  isPlausibleOrderIdentifier,
} from "./order-identifier";

describe("order identifier extraction", () => {
  it("parses Order #555 as 555", () => {
    assert.deepEqual(extractOrderIdentifiers("Order #555"), ["555"]);
    assert.equal(isPlausibleOrderIdentifier("555"), true);
  });

  it("parses Order number 555 and Order: AB-555", () => {
    assert.deepEqual(extractOrderIdentifiers("Order number 555"), ["555"]);
    assert.deepEqual(extractOrderIdentifiers("Order: AB-555"), ["AB-555"]);
  });

  it("does not treat the word order as an identifier", () => {
    assert.deepEqual(extractOrderIdentifiers("order"), []);
    assert.deepEqual(extractOrderIdentifiers("Re: order"), []);
    assert.equal(isPlausibleOrderIdentifier("order"), false);
    assert.equal(isPlausibleOrderIdentifier("invoice"), false);
    assert.equal(isPlausibleOrderIdentifier("confirmation"), false);
    assert.equal(isPlausibleOrderIdentifier("update"), false);
    assert.equal(isPlausibleOrderIdentifier("presentation"), false);
  });

  it("captures 555 when subject says order and body says Order #555", () => {
    assert.deepEqual(
      extractOrderIdentifiers("order\nOrder #555"),
      ["555"],
    );
  });

  it("does not treat PO 18429 as an order identifier", () => {
    assert.deepEqual(extractOrderIdentifiers("PO 18429"), []);
    assert.deepEqual(extractOrderIdentifiers("Please see PO 18429"), []);
  });

  it("fails closed on malformed or word-only syntax", () => {
    assert.deepEqual(extractOrderIdentifiers("order confirmation"), []);
    assert.deepEqual(extractOrderIdentifiers("invoice update presentation"), []);
    assert.deepEqual(extractOrderIdentifiers("in order to proceed"), []);
  });
});
