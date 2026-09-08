import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hashEmail } from "../hashes";
import { resolvePersonHit } from "../../gmail/candidates/associate";
import {
  candidateWorldFromRows,
  GMAIL_PERSON_PROFILES_TABLE,
  GMAIL_PROJECT_HISTORY_TABLE,
  loadGmailPersonWorld,
} from "./gmail-world";

const DIR = dirname(fileURLToPath(import.meta.url));

function thenable<T>(value: T) {
  const chain = {
    select() {
      return chain;
    },
    eq() {
      return chain;
    },
    is() {
      return chain;
    },
    then(
      onFulfilled: (value: T) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(value).then(onFulfilled, onRejected);
    },
  };
  return chain;
}

function fakeClient(
  tables: Record<
    string,
    { data?: Record<string, unknown>[]; error?: { code?: string; message?: string } | null }
  >,
) {
  const queried: string[] = [];
  return {
    queried,
    from(table: string) {
      queried.push(table);
      const row = tables[table];
      if (!row) {
        return thenable({
          data: null,
          error: {
            code: "PGRST205",
            message: `Could not find the table 'public.${table}' in the schema cache`,
          },
        });
      }
      return thenable({
        data: row.data ?? [],
        error: row.error ?? null,
      });
    },
  };
}

describe("Gmail candidate world from Continuum identity", () => {
  it("binds Abbey Castillo by email hash and never Abbey Wagner", () => {
    const world = candidateWorldFromRows({
      people: [
        {
          person_id: "castillo",
          display_name: "Abbey Castillo",
          email: "serinitybloom@gmail.com",
          roles: ["client"],
        },
        {
          person_id: "wagner",
          display_name: "Abbey Wagner",
          email: "abbey.wagner@example.test",
          roles: ["client"],
        },
      ],
      projects: [
        {
          project_id: "engagement",
          display_title: "Castillo engagement ring",
          project_kind: "custom_new_jewelry",
        },
        {
          project_id: "repair",
          display_title: "Wagner watch repair",
          project_kind: "repair_service",
        },
      ],
      histories: [],
      relationships: [
        {
          id: "r1",
          from_entity_id: "castillo",
          to_entity_id: "engagement",
          kind: "client-project",
          status: "active",
        },
        {
          id: "r2",
          from_entity_id: "wagner",
          to_entity_id: "repair",
          kind: "client-project",
          status: "active",
        },
      ],
    });
    const castillo = world.people.find((row) => row.personId === "castillo");
    const wagner = world.people.find((row) => row.personId === "wagner");
    assert.equal(castillo?.emailHash, hashEmail("serinitybloom@gmail.com"));
    assert.equal(wagner?.emailHash, hashEmail("abbey.wagner@example.test"));
    assert.notEqual(castillo?.emailHash, wagner?.emailHash);
    assert.deepEqual(castillo?.projectIds, ["engagement"]);
    assert.deepEqual(wagner?.projectIds, ["repair"]);
    assert.deepEqual(world.confirmedParticipantMappings, []);
    assert.deepEqual(world.founderConfirmedEmailIdentities, []);
  });

  it("isolates one malformed Person and keeps Nate", () => {
    const world = candidateWorldFromRows({
      people: [
        { display_name: "No id" },
        { person_id: "missing-name" },
        {
          person_id: "nate",
          display_name: "Nathan Pearl",
          email: "nate.pearl@example.test",
          roles: ["client"],
        },
        { person_id: "bad-roles", display_name: "Roles object", roles: { client: true } },
      ],
      projects: [{ project_id: "gone", display_title: "" }],
      histories: [{ project_id: "stale-history" }],
      relationships: [
        {
          from_entity_id: "nate",
          to_entity_id: "deleted-project",
          kind: "client-project",
          status: "active",
        },
      ],
    });
    assert.equal(world.people.length, 2);
    assert.equal(world.people[0]?.personId, "nate");
    assert.equal(world.people[1]?.personId, "bad-roles");
    assert.equal(world.people[1]?.emailHash, null);
    assert.deepEqual(world.people[0]?.projectIds, []);
    assert.deepEqual(world.projects, []);
  });

  it("keeps a Person whose email is missing or invalid without asserting identity", () => {
    const world = candidateWorldFromRows({
      people: [
        { person_id: "no-email", display_name: "No Email", roles: ["client"] },
        {
          person_id: "bad-email",
          display_name: "Bad Email",
          email: "not-an-email",
          roles: ["client"],
        },
      ],
      projects: [],
      histories: [],
      relationships: [],
    });
    assert.equal(world.people.length, 2);
    assert.equal(world.people[0]?.emailHash, null);
    assert.equal(world.people[1]?.emailHash, null);
  });

  it("does not assert identity from a duplicate raw email hash", () => {
    const world = candidateWorldFromRows({
      people: [
        {
          person_id: "one",
          display_name: "Ada One",
          email: "shared@example.test",
          roles: ["client"],
        },
        {
          person_id: "two",
          display_name: "Ada Two",
          email: "shared@example.test",
          roles: ["client"],
        },
      ],
      projects: [],
      histories: [],
      relationships: [],
    });
    const hit = resolvePersonHit({
      fromEmailHash: hashEmail("shared@example.test"),
      people: world.people,
      internalEmailHashes: [],
    });
    assert.equal(hit.person, null);
    assert.equal(hit.possiblePerson, null);
    assert.equal(hit.ruleIds.includes("email_hash_collision"), true);
  });

  it("queries the canonical singular history table, not the Production-missing plural", async () => {
    const client = fakeClient({
      [GMAIL_PERSON_PROFILES_TABLE]: {
        data: [
          {
            person_id: "nate",
            display_name: "Nathan Pearl",
            email: "nate.pearl@example.test",
            roles: ["client"],
          },
        ],
      },
      continuum_project_profiles: {
        data: [{ project_id: "p1", display_title: "Existing" }],
      },
      [GMAIL_PROJECT_HISTORY_TABLE]: {
        data: [{ project_id: "p1", cad_job_number: "CAD-1" }],
      },
      continuum_relationships: { data: [] },
      continuum_calendar_participant_mappings: { data: [] },
      continuum_external_identities: { data: [] },
    });
    const loaded = await loadGmailPersonWorld(client as never);
    assert.equal(client.queried.includes("continuum_project_histories"), false);
    assert.equal(client.queried.includes(GMAIL_PROJECT_HISTORY_TABLE), true);
    assert.equal(client.queried.includes(GMAIL_PERSON_PROFILES_TABLE), true);
    assert.equal(loaded.peopleAvailable, true);
    assert.equal(loaded.world.people[0]?.displayName, "Nathan Pearl");
    assert.equal(loaded.world.projects[0]?.cadJobNumber, "CAD-1");
    assert.equal(loaded.directory[0]?.displayName, "Nathan Pearl");
  });

  it("keeps People available when Production returns PGRST205 for the missing plural history name", async () => {
    const client = fakeClient({
      [GMAIL_PERSON_PROFILES_TABLE]: {
        data: [
          {
            person_id: "castillo",
            display_name: "Abbey Castillo",
            email: "serinitybloom@gmail.com",
            roles: ["client"],
          },
        ],
      },
      continuum_project_profiles: {
        data: [{ project_id: "earrings", display_title: "Matching Marquise Earrings" }],
      },
      continuum_project_histories: {
        error: {
          code: "PGRST205",
          message:
            "Could not find the table 'public.continuum_project_histories' in the schema cache",
        },
      },
      continuum_relationships: { data: [] },
      continuum_calendar_participant_mappings: { data: [] },
      continuum_external_identities: { data: [] },
    });
    const loaded = await loadGmailPersonWorld(client as never);
    assert.equal(loaded.peopleAvailable, true);
    assert.equal(loaded.world.people[0]?.displayName, "Abbey Castillo");
    assert.equal(loaded.world.projects[0]?.cadJobNumber, null);
  });

  it("marks identity unavailable when person profiles cannot be read, without throwing", async () => {
    const client = fakeClient({
      [GMAIL_PERSON_PROFILES_TABLE]: {
        error: { code: "PGRST205", message: "read-person-profiles-failed" },
      },
      continuum_project_profiles: {
        data: [{ project_id: "p1", display_title: "Existing" }],
      },
      [GMAIL_PROJECT_HISTORY_TABLE]: { data: [] },
      continuum_relationships: { data: [] },
      continuum_calendar_participant_mappings: { data: [] },
      continuum_external_identities: { data: [] },
    });
    const loaded = await loadGmailPersonWorld(client as never);
    assert.equal(loaded.peopleAvailable, false);
    assert.deepEqual(loaded.world.people, []);
    assert.equal(loaded.directory.length, 0);
    assert.equal(loaded.world.projects[0]?.title, "Existing");
  });

  it("uses the same Person and history tables as the canonical Client Memory reader", () => {
    const source = readFileSync(join(DIR, "gmail-world.ts"), "utf8");
    const reader = readFileSync(join(DIR, "../read/supabase.ts"), "utf8");
    assert.match(source, /continuum_project_history/);
    assert.doesNotMatch(source, /continuum_project_histories/);
    assert.match(reader, /from\("continuum_person_profiles"\)/);
    assert.match(reader, /from\("continuum_project_history"\)/);
    assert.match(source, /from\(GMAIL_PERSON_PROFILES_TABLE\)/);
  });
});
