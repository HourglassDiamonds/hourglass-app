import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  candidateHasTypedOrderIdentifier,
  classifyOrderIdentifierStrength,
  extractOrderIdentifiers,
  isPlausibleOrderIdentifier,
  isStrongStructuredOrderIdentifier,
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

describe("order identifier strength", () => {
  it("classifies numeric orders as weak and structured orders as strong", () => {
    assert.equal(classifyOrderIdentifierStrength("555"), "weak_numeric");
    assert.equal(isStrongStructuredOrderIdentifier("555"), false);
    assert.equal(classifyOrderIdentifierStrength("AB-555"), "strong_structured");
    assert.equal(isStrongStructuredOrderIdentifier("AB-555"), true);
  });

  it("requires typed order context on the candidate side", () => {
    assert.equal(candidateHasTypedOrderIdentifier("Invoice 555", "555"), false);
    assert.equal(candidateHasTypedOrderIdentifier("Payment 555", "555"), false);
    assert.equal(candidateHasTypedOrderIdentifier("Re: 555", "555"), false);
    assert.equal(candidateHasTypedOrderIdentifier("Job 555", "555"), false);
    assert.equal(candidateHasTypedOrderIdentifier("555 reminder", "555"), false);
    assert.equal(candidateHasTypedOrderIdentifier("Invoice AB-555", "555"), false);
    assert.equal(candidateHasTypedOrderIdentifier("Order #555", "555"), true);
    assert.equal(candidateHasTypedOrderIdentifier("Order number 555", "555"), true);
    assert.equal(candidateHasTypedOrderIdentifier("Order: AB-555", "AB-555"), true);
  });
});
