import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CURRENT_OPERATING_BACKLOG,
  type OperatingBacklog,
  type OperatingBacklogItem,
} from "@/lib/agent-os/operating-backlog";
import { selectMasterSprintCapacityItems } from "./master-sprint";

function eligibleItem(
  id: string,
  rank: number,
  extra: Partial<OperatingBacklogItem> = {},
): OperatingBacklogItem {
  return {
    id,
    kind: "sprint-priority",
    title: `Approved sprint ${id}`,
    action: `Advance ${id}`,
    why: "Canonical approved sprint item.",
    expectedOutcome: "Done.",
    status: "active",
    urgency: "high",
    rank,
    surfacePolicy: "founder-now",
    ...extra,
  };
}

function backlogOf(items: OperatingBacklogItem[]): OperatingBacklog {
  return {
    ...CURRENT_OPERATING_BACKLOG,
    masterSprint: {
      ...CURRENT_OPERATING_BACKLOG.masterSprint,
      items,
    },
  };
}

describe("Master Sprint unused-capacity adapter", () => {
  it("selects only approved founder-now sprint items in rank order", () => {
    const selected = selectMasterSprintCapacityItems(
      backlogOf([
        eligibleItem("sprint-watch", 1, { surfacePolicy: "watch" }),
        eligibleItem("sprint-done", 2, { status: "completed" }),
        eligibleItem("sprint-paused", 3, { watchLine: "paused by founder" }),
        eligibleItem("sprint-background", 4, { surfacePolicy: "background" }),
        eligibleItem("sprint-later", 6),
        eligibleItem("sprint-first", 5),
      ]),
    );
    assert.deepEqual(
      selected.map((item) => item.id),
      ["sprint-first", "sprint-later"],
    );
    assert.equal(selected[0]?.title, "Approved sprint sprint-first");
  });

  it("does not invent sprint work from the static backlog when nothing is founder-now", () => {
    const selected = selectMasterSprintCapacityItems(CURRENT_OPERATING_BACKLOG);
    assert.equal(
      selected.every((item) =>
        CURRENT_OPERATING_BACKLOG.masterSprint.items.some(
          (row) =>
            row.id === item.id &&
            row.status !== "completed" &&
            row.surfacePolicy === "founder-now",
        ),
      ),
      true,
    );
  });
});
