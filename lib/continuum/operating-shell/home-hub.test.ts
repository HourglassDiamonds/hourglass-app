import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONCIERGE_ASK_PATH,
  CONCIERGE_CLIENTS_PATH,
  CONCIERGE_HOME_PATH,
  CONCIERGE_HUB_PATH,
  CONCIERGE_PERSONAL_PATH,
  CONCIERGE_PROJECTS_PATH,
  CONCIERGE_REPAIRS_PATH,
} from "./destinations";
import {
  MOBILE_HUB_ASK_PLACEHOLDER,
  MOBILE_HUB_CONCIERGE_MODES,
  MOBILE_HUB_DESTINATIONS,
  composeHomeGlance,
} from "./home-hub";

describe("Mobile Home hub", () => {
  it("keeps the five primary destinations in founder order", () => {
    assert.deepEqual(
      MOBILE_HUB_DESTINATIONS.map((row) => row.id),
      ["today", "projects", "repairs", "clients", "personal"],
    );
    assert.deepEqual(
      MOBILE_HUB_DESTINATIONS.map((row) => row.href),
      [
        CONCIERGE_HOME_PATH,
        CONCIERGE_PROJECTS_PATH,
        CONCIERGE_REPAIRS_PATH,
        CONCIERGE_CLIENTS_PATH,
        CONCIERGE_PERSONAL_PATH,
      ],
    );
    assert.equal(CONCIERGE_HUB_PATH, "/executive-dashboard/concierge/home");
    assert.equal(CONCIERGE_HOME_PATH, "/executive-dashboard/concierge");
    assert.equal(MOBILE_HUB_ASK_PLACEHOLDER, "Ask a question...");
  });

  it("routes Concierge modes into existing Ask / capture surfaces", () => {
    assert.deepEqual(
      MOBILE_HUB_CONCIERGE_MODES.map((row) => row.id),
      ["brain-dump", "conversation", "design"],
    );
    assert.equal(MOBILE_HUB_CONCIERGE_MODES[0]?.href, `${CONCIERGE_ASK_PATH}?mode=brain-dump`);
    assert.equal(MOBILE_HUB_CONCIERGE_MODES[1]?.href, CONCIERGE_ASK_PATH);
    assert.equal(MOBILE_HUB_CONCIERGE_MODES[2]?.href, `${CONCIERGE_ASK_PATH}?mode=design`);
  });

  it("omits glance tiles that cannot be derived or are zero", () => {
    assert.deepEqual(
      composeHomeGlance({ groups: [], openRepairCount: 0 }),
      [],
    );
    assert.deepEqual(
      composeHomeGlance({
        groups: [
          { id: "your_turn", count: 3 },
          { id: "waiting_for_client", count: 0 },
          { id: "cad_design", count: 4 },
        ],
        openRepairCount: 1,
      }),
      [
        { id: "your_turn", count: 3, label: "Your turn" },
        { id: "repair_active", count: 1, label: "Repair active" },
      ],
    );
    assert.deepEqual(
      composeHomeGlance({
        groups: [
          { id: "your_turn", count: 3 },
          { id: "waiting_for_client", count: 2 },
          { id: "in_production", count: 1 },
        ],
        openRepairCount: 1,
      }),
      [
        { id: "your_turn", count: 3, label: "Your turn" },
        { id: "waiting_for_client", count: 2, label: "Waiting on client" },
        { id: "in_production", count: 1, label: "In production" },
        { id: "repair_active", count: 1, label: "Repair active" },
      ],
    );
  });
});
