import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONCIERGE_ASK_PATH,
  CONCIERGE_CLIENTS_PATH,
  CONCIERGE_HOME_PATH,
  CONCIERGE_PROJECTS_PATH,
  CONCIERGE_REPAIRS_PATH,
  OPERATING_DESTINATIONS,
  OPERATING_TOOL_LINKS,
  destinationBackForPath,
  isOperatingDestinationHome,
  operatingDestinationForPath,
  operatingShellVariantForPath,
} from "./destinations";

describe("Founder operating destinations", () => {
  it("exposes exactly five primary destinations", () => {
    assert.equal(OPERATING_DESTINATIONS.length, 5);
    assert.deepEqual(
      OPERATING_DESTINATIONS.map((row) => row.id),
      ["today", "projects", "clients", "repairs", "concierge"],
    );
    assert.deepEqual(
      OPERATING_DESTINATIONS.map((row) => row.href),
      [
        CONCIERGE_HOME_PATH,
        CONCIERGE_PROJECTS_PATH,
        CONCIERGE_CLIENTS_PATH,
        CONCIERGE_REPAIRS_PATH,
        CONCIERGE_ASK_PATH,
      ],
    );
    assert.equal(CONCIERGE_HOME_PATH, "/executive-dashboard/concierge");
  });

  it("keeps Gmail Inbox Calendar Reconstruction Passkeys and Digital Card as secondary tools", () => {
    assert.deepEqual(
      OPERATING_TOOL_LINKS.map((row) => row.id),
      ["gmail", "inbox", "calendar", "reconstruction", "passkeys", "card"],
    );
    assert.equal(
      OPERATING_TOOL_LINKS.some((row) => row.id === "today"),
      false,
    );
  });

  it("selects destinations without treating tools as primary", () => {
    assert.equal(operatingDestinationForPath(CONCIERGE_HOME_PATH), "today");
    assert.equal(operatingDestinationForPath(`${CONCIERGE_HOME_PATH}/`), "today");
    assert.equal(
      operatingDestinationForPath(`${CONCIERGE_PROJECTS_PATH}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`),
      "projects",
    );
    assert.equal(
      operatingDestinationForPath(`${CONCIERGE_HOME_PATH}/client/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`),
      "clients",
    );
    assert.equal(operatingDestinationForPath(CONCIERGE_CLIENTS_PATH), "clients");
    assert.equal(
      operatingDestinationForPath(
        `${CONCIERGE_PROJECTS_PATH}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/repair/quotes`,
      ),
      "repairs",
    );
    assert.equal(operatingDestinationForPath(CONCIERGE_REPAIRS_PATH), "repairs");
    assert.equal(operatingDestinationForPath(CONCIERGE_ASK_PATH), "concierge");
    assert.equal(
      operatingDestinationForPath(`${CONCIERGE_HOME_PATH}/note/new`),
      "concierge",
    );
    assert.equal(operatingDestinationForPath(`${CONCIERGE_HOME_PATH}/gmail`), null);
    assert.equal(operatingDestinationForPath(`${CONCIERGE_HOME_PATH}/calendar`), null);
    assert.equal(operatingDestinationForPath("/executive-dashboard/security/passkeys"), null);
  });

  it("uses wide shells on destination homes and narrow shells on nested documents", () => {
    assert.equal(operatingShellVariantForPath(CONCIERGE_HOME_PATH), "home");
    assert.equal(operatingShellVariantForPath(CONCIERGE_PROJECTS_PATH), "home");
    assert.equal(
      operatingShellVariantForPath(
        `${CONCIERGE_PROJECTS_PATH}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      ),
      "document",
    );
    assert.equal(isOperatingDestinationHome(CONCIERGE_ASK_PATH), true);
  });

  it("sends nested pages back to their destination, not always Today", () => {
    assert.deepEqual(
      destinationBackForPath(
        `${CONCIERGE_PROJECTS_PATH}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      ),
      { href: CONCIERGE_PROJECTS_PATH, label: "Projects" },
    );
    assert.deepEqual(
      destinationBackForPath(
        `${CONCIERGE_HOME_PATH}/client/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      ),
      { href: CONCIERGE_CLIENTS_PATH, label: "Clients" },
    );
    assert.deepEqual(
      destinationBackForPath(
        `${CONCIERGE_PROJECTS_PATH}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/repair/quotes/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
      ),
      { href: CONCIERGE_REPAIRS_PATH, label: "Repairs" },
    );
    assert.deepEqual(destinationBackForPath(`${CONCIERGE_HOME_PATH}/gmail`), {
      href: CONCIERGE_HOME_PATH,
      label: "Today",
    });
    assert.deepEqual(destinationBackForPath(`${CONCIERGE_HOME_PATH}/note/new`), {
      href: CONCIERGE_ASK_PATH,
      label: "Concierge",
    });
  });
});
