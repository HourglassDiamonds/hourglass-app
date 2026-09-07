import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE,
  candidateStorageStateFromError,
  probeCandidateStorage,
} from "./activation";

describe("Candidate durable storage activation", () => {
  it("names the fail-closed founder message", () => {
    assert.equal(CANDIDATE_STORAGE_NOT_ACTIVATED_MESSAGE, "Candidate storage not activated");
  });

  it("treats a missing continuum_candidates table as not-activated", async () => {
    assert.equal(
      candidateStorageStateFromError({ code: "42P01" }),
      "not-activated",
    );
    assert.equal(
      candidateStorageStateFromError({
        code: "PGRST205",
        message: "Could not find the table 'public.continuum_candidates' in the schema cache",
      }),
      "not-activated",
    );
    const probed = await probeCandidateStorage({
      from: () => ({
        select: () => ({
          limit: async () => ({
            error: { code: "PGRST205", message: "continuum_candidates schema cache" },
          }),
        }),
      }),
    });
    assert.equal(probed, "not-activated");
  });

  it("does not treat unrelated errors as activated", async () => {
    assert.equal(candidateStorageStateFromError({ code: "42501" }), null);
    const probed = await probeCandidateStorage({
      from: () => ({
        select: () => ({
          limit: async () => ({ error: { code: "42501", message: "permission denied" } }),
        }),
      }),
    });
    assert.equal(probed, "unavailable");
  });
});
