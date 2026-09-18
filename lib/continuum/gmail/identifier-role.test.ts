import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractProjectContext, extractStructuredSpecs } from "./candidates/parse";
import type { GmailCandidateProject } from "./candidates/types";
import {
  classifyIdentifierRole,
  extractTypedIdentifiers,
  identifierRolesAreSameField,
} from "./identifier-role";

const JEN_VENDOR_TEXT = [
  "RE: HGD x Tim/Jenn-C025964-RN08318",
  "We're sending your stone to our workshop via job RN08318.",
  "I'll send you the final cad for review...",
].join("\n");

function jenProject(): GmailCandidateProject {
  return {
    projectId: "proj-jen",
    title: "Lee / Spiegel",
    gmailThreadId: "19fc9f4c3d36dbed",
    cadJobNumber: "C025964",
    orderNumber: null,
    fingerSize: null,
    metal: null,
    centerStone: null,
    diamondSupplyNotes: null,
    personIds: ["person-jen"],
    founderApprovedCurrent: true,
  };
}

describe("typed identifier roles", () => {
  it("classifies C-prefix CAD ids separately from RN workshop jobs", () => {
    assert.equal(classifyIdentifierRole("C025964"), "cadId");
    assert.equal(classifyIdentifierRole("C010657"), "cadId");
    assert.equal(
      classifyIdentifierRole("RN08318", "workshop via job RN08318"),
      "workshopJobId",
    );
    assert.equal(classifyIdentifierRole("RN04163"), "workshopJobId");
    assert.equal(classifyIdentifierRole("SP13040"), "vendorOrderId");
    assert.equal(identifierRolesAreSameField("C025964", "RN08318"), false);
    assert.equal(identifierRolesAreSameField("C025964", "C026111"), true);
  });

  it("does not mint RN08318 as cad_job_number against canonical C025964", () => {
    const hits = extractStructuredSpecs(JEN_VENDOR_TEXT, jenProject());
    assert.equal(
      hits.some((hit) => hit.fieldName === "cad_job_number"),
      false,
    );
    assert.equal(
      hits.some((hit) => hit.proposedValue === "RN08318"),
      false,
    );
    const typed = extractTypedIdentifiers(JEN_VENDOR_TEXT);
    assert.ok(
      typed.some((hit) => hit.role === "workshopJobId" && hit.value === "RN08318"),
    );
    assert.equal(
      typed.some((hit) => hit.role === "cadId" && hit.value === "RN08318"),
      false,
    );
    const context = extractProjectContext(JEN_VENDOR_TEXT);
    assert.ok(
      context.some(
        (hit) => hit.topic === "workshop_job_id" && hit.value === "RN08318",
      ),
    );
  });

  it("still extracts a replacement CAD id into cad_job_number", () => {
    const hits = extractStructuredSpecs(
      "Updated CAD C026111 replacing C025964",
      jenProject(),
    );
    assert.ok(
      hits.some(
        (hit) =>
          hit.fieldName === "cad_job_number" &&
          hit.proposedValue === "C026111" &&
          hit.conflict === true,
      ),
    );
  });
});
