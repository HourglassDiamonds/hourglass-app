import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { saveOwnerDigitalCard } from "./owner";
import { InMemoryDigitalCardStore } from "./store";
import type { DigitalCard } from "./types";

const NOW = "2026-08-25T19:00:00.000Z";

describe("owner digital card writer", () => {
  it("creates one card per owner and rejects a taken slug", async () => {
    const store = new InMemoryDigitalCardStore();
    const depsA = {
      nowIso: () => NOW,
      newId: () => randomUUID(),
      ownerUsername: "owner-a",
      getCardByOwner: (owner: string) => store.getCardByOwner(owner),
      getCardBySlug: (slug: string) => store.getCardBySlug(slug),
      upsertCard: (card: DigitalCard) => store.upsertCard(card),
    };
    const created = await saveOwnerDigitalCard(depsA, {
      displayName: "Ada Lovelace",
      slug: "ada-lovelace",
      published: true,
    });
    assert.equal(created.status, "saved");
    const taken = await saveOwnerDigitalCard(
      { ...depsA, ownerUsername: "owner-b", newId: () => randomUUID() },
      { displayName: "Someone Else", slug: "ada-lovelace", published: true },
    );
    assert.equal(taken.status, "validation-error");
    if (taken.status === "validation-error") {
      assert.equal(taken.code, "slug-taken");
      assert.equal(taken.fieldErrors.slug, "That public link is already in use.");
    }
  });

  it("does not authorize writes by itself ??? session gating lives in load.ts", async () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "load.ts"),
      "utf8",
    );
    assert.match(source, /requireInternalClientMemorySession/);
    assert.match(source, /unauthorized/);
  });
});
