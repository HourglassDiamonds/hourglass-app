import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashEmail } from "../hashes";
import { candidateWorldFromRows } from "./gmail-world";

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
  });
});
