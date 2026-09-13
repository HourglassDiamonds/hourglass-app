/**
 * Mobile Home hub copy and glance composition.
 * Read-model only. Does not rank Today, mutate Projects, or invent counts.
 */

import {
  CONCIERGE_ASK_PATH,
  CONCIERGE_CLIENTS_PATH,
  CONCIERGE_HOME_PATH,
  CONCIERGE_PERSONAL_PATH,
  CONCIERGE_PROJECTS_PATH,
  CONCIERGE_REPAIRS_PATH,
  conciergeAskPath,
  type ConciergeAskMode,
} from "@/lib/continuum/client-memory/read/presentation";
import type { CurrentProjectOperatingGroup } from "@/lib/continuum/client-memory/open-projects/operating-groups";

export const MOBILE_HUB_DESTINATION_IDS = [
  "today",
  "projects",
  "repairs",
  "clients",
  "personal",
] as const;

export type MobileHubDestinationId = (typeof MOBILE_HUB_DESTINATION_IDS)[number];

export type MobileHubDestination = {
  id: MobileHubDestinationId;
  label: string;
  href: string;
  descriptor: string;
};

export const MOBILE_HUB_DESTINATIONS: readonly MobileHubDestination[] = [
  {
    id: "today",
    label: "Today",
    href: CONCIERGE_HOME_PATH,
    descriptor: "What needs your attention",
  },
  {
    id: "projects",
    label: "Projects",
    href: CONCIERGE_PROJECTS_PATH,
    descriptor: "Active work and next steps",
  },
  {
    id: "repairs",
    label: "Repairs",
    href: CONCIERGE_REPAIRS_PATH,
    descriptor: "Quotes, status and follow-ups",
  },
  {
    id: "clients",
    label: "Clients",
    href: CONCIERGE_CLIENTS_PATH,
    descriptor: "Relationships and history",
  },
  {
    id: "personal",
    label: "Personal",
    href: CONCIERGE_PERSONAL_PATH,
    descriptor: "Life, family and everything else",
  },
];

export type MobileHubConciergeMode = {
  id: ConciergeAskMode;
  label: string;
  href: string;
  descriptor: string;
};

export const MOBILE_HUB_CONCIERGE_MODES: readonly MobileHubConciergeMode[] = [
  {
    id: "brain-dump",
    label: "Brain Dump",
    href: conciergeAskPath({ mode: "brain-dump" }),
    descriptor: "Fast capture — get it out of your head",
  },
  {
    id: "conversation",
    label: "Conversation",
    href: CONCIERGE_ASK_PATH,
    descriptor: "Normal back-and-forth with Concierge",
  },
  {
    id: "design",
    label: "Design Mode",
    href: conciergeAskPath({ mode: "design" }),
    descriptor: "Jewelry, design, and spec-focused questions",
  },
];

export const MOBILE_HUB_ASK_PLACEHOLDER = "Ask a question...";

export type HomeGlanceTileId =
  | "your_turn"
  | "waiting_for_client"
  | "in_production"
  | "repair_active";

export type HomeGlanceTile = {
  id: HomeGlanceTileId;
  count: number;
  label: string;
};

const GLANCE_FROM_GROUPS: readonly {
  groupId: CurrentProjectOperatingGroup["id"];
  id: HomeGlanceTileId;
  label: string;
}[] = [
  { groupId: "your_turn", id: "your_turn", label: "Your turn" },
  {
    groupId: "waiting_for_client",
    id: "waiting_for_client",
    label: "Waiting on client",
  },
  { groupId: "in_production", id: "in_production", label: "In production" },
];

export function composeHomeGlance(input: {
  groups: readonly Pick<CurrentProjectOperatingGroup, "id" | "count">[];
  openRepairCount: number;
}): HomeGlanceTile[] {
  const tiles: HomeGlanceTile[] = [];
  for (const row of GLANCE_FROM_GROUPS) {
    const group = input.groups.find((item) => item.id === row.groupId);
    const count = group?.count ?? 0;
    if (count <= 0) continue;
    tiles.push({ id: row.id, count, label: row.label });
  }
  if (Number.isInteger(input.openRepairCount) && input.openRepairCount > 0) {
    tiles.push({
      id: "repair_active",
      count: input.openRepairCount,
      label: "Repair active",
    });
  }
  return tiles;
}
