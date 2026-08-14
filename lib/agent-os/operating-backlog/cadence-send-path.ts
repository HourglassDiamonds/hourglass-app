/**
 * Test/ops clone of CURRENT with a unique founder-now item so cadence
 * send-path tests can exercise a real founder-brief send.
 *
 * The item id is not in CURRENT, so weekly/historical bootstrap of production
 * terminals cannot complete it out from under the send-path clone.
 * Not the production backlog. Do not use as Today’s Call inventory.
 */

import { CURRENT_OPERATING_BACKLOG } from "./current-sprint";
import type { OperatingBacklog } from "./types";

export const CADENCE_SEND_PATH_ITEM_ID = "sprint-cadence-send-path-probe";

export function operatingBacklogForCadenceSendPath(): OperatingBacklog {
  return {
    ...CURRENT_OPERATING_BACKLOG,
    masterSprint: {
      ...CURRENT_OPERATING_BACKLOG.masterSprint,
      items: [
        {
          id: CADENCE_SEND_PATH_ITEM_ID,
          kind: "sprint-priority",
          title: "Confirm Concierge path from flagship content",
          action:
            "Spot-check three live CTAs and confirm attribution params on the Concierge landing URL.",
          why: "Test-only founder-now item so cadence send-path can be exercised.",
          expectedOutcome:
            "Sendable daily brief for delivery-path tests — not a production commitment.",
          status: "active",
          urgency: "high",
          rank: 0,
          surfacePolicy: "founder-now",
          orientation:
            "Protect conversion gains. Confirm Concierge path from flagship content.",
          completionCondition: "Test-only; not a production commitment.",
          linkedRecommendationId: null,
        },
        ...CURRENT_OPERATING_BACKLOG.masterSprint.items,
      ],
    },
  };
}
