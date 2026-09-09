/**
 * Founder Operating UX V1 destination map.
 * Views of one canonical Continuum system. No second identity or repair object.
 */

import { CONCIERGE_CALENDAR_PATH } from "@/lib/continuum/calendar/types";
import { conciergeMyCardPath } from "@/lib/continuum/digital-card/paths";
import { CONCIERGE_GMAIL_PATH } from "@/lib/continuum/gmail/types";
import {
  CONCIERGE_ASK_PATH,
  CONCIERGE_CLIENTS_PATH,
  CONCIERGE_COHORT_1_PATH,
  CONCIERGE_HOME_PATH,
  CONCIERGE_PROJECTS_PATH,
  CONCIERGE_REPAIRS_PATH,
  conciergeInboxPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { EXECUTIVE_DASHBOARD_PASSKEYS_PATH } from "@/lib/executive-dashboard/access";

export {
  CONCIERGE_ASK_PATH,
  CONCIERGE_CLIENTS_PATH,
  CONCIERGE_HOME_PATH,
  CONCIERGE_PROJECTS_PATH,
  CONCIERGE_REPAIRS_PATH,
};

export const OPERATING_DESTINATION_IDS = [
  "today",
  "projects",
  "clients",
  "repairs",
  "concierge",
] as const;

export type OperatingDestinationId = (typeof OPERATING_DESTINATION_IDS)[number];

export type OperatingDestination = {
  id: OperatingDestinationId;
  label: string;
  href: string;
};

export const OPERATING_DESTINATIONS: readonly OperatingDestination[] = [
  { id: "today", label: "Today", href: CONCIERGE_HOME_PATH },
  { id: "projects", label: "Projects", href: CONCIERGE_PROJECTS_PATH },
  { id: "clients", label: "Clients", href: CONCIERGE_CLIENTS_PATH },
  { id: "repairs", label: "Repairs", href: CONCIERGE_REPAIRS_PATH },
  { id: "concierge", label: "Concierge", href: CONCIERGE_ASK_PATH },
];

export type OperatingToolLink = {
  id: string;
  label: string;
  href: string;
};

export const OPERATING_TOOL_LINKS: readonly OperatingToolLink[] = [
  { id: "gmail", label: "Gmail", href: CONCIERGE_GMAIL_PATH },
  { id: "inbox", label: "Inbox", href: conciergeInboxPath() },
  { id: "calendar", label: "Calendar", href: CONCIERGE_CALENDAR_PATH },
  { id: "reconstruction", label: "Reconstruction", href: CONCIERGE_COHORT_1_PATH },
  { id: "passkeys", label: "Passkeys", href: EXECUTIVE_DASHBOARD_PASSKEYS_PATH },
  { id: "card", label: "Digital Card", href: conciergeMyCardPath() },
];

export type DestinationBackLink = {
  href: string;
  label: string;
};

const PROJECT_REPAIR_RE =
  /^\/executive-dashboard\/concierge\/projects\/[^/]+\/repair(?:\/|$)/;

export function normalizeConciergePath(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] ?? "";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function isOperatingDestinationHome(pathname: string): boolean {
  const path = normalizeConciergePath(pathname);
  return (
    path === CONCIERGE_HOME_PATH ||
    path === CONCIERGE_PROJECTS_PATH ||
    path === CONCIERGE_CLIENTS_PATH ||
    path === CONCIERGE_REPAIRS_PATH ||
    path === CONCIERGE_ASK_PATH
  );
}

export function operatingDestinationForPath(
  pathname: string,
): OperatingDestinationId | null {
  const path = normalizeConciergePath(pathname);
  if (path === CONCIERGE_HOME_PATH) return "today";
  if (path === CONCIERGE_ASK_PATH || path.startsWith(`${CONCIERGE_ASK_PATH}/`)) {
    return "concierge";
  }
  if (path.startsWith(`${CONCIERGE_HOME_PATH}/note`)) {
    return "concierge";
  }
  if (
    path === CONCIERGE_CLIENTS_PATH ||
    path.startsWith(`${CONCIERGE_CLIENTS_PATH}/`) ||
    path.startsWith(`${CONCIERGE_HOME_PATH}/client/`)
  ) {
    return "clients";
  }
  if (
    path === CONCIERGE_REPAIRS_PATH ||
    path.startsWith(`${CONCIERGE_REPAIRS_PATH}/`) ||
    PROJECT_REPAIR_RE.test(path)
  ) {
    return "repairs";
  }
  if (
    path === CONCIERGE_PROJECTS_PATH ||
    path.startsWith(`${CONCIERGE_PROJECTS_PATH}/`)
  ) {
    return "projects";
  }
  return null;
}

export function operatingShellVariantForPath(
  pathname: string,
): "home" | "document" {
  return isOperatingDestinationHome(pathname) ? "home" : "document";
}

export function destinationBackForPath(pathname: string): DestinationBackLink {
  const path = normalizeConciergePath(pathname);
  if (isOperatingDestinationHome(path)) {
    return { href: CONCIERGE_HOME_PATH, label: "Today" };
  }
  const destination = operatingDestinationForPath(path);
  if (destination === "clients") {
    return { href: CONCIERGE_CLIENTS_PATH, label: "Clients" };
  }
  if (destination === "repairs") {
    return { href: CONCIERGE_REPAIRS_PATH, label: "Repairs" };
  }
  if (destination === "projects") {
    return { href: CONCIERGE_PROJECTS_PATH, label: "Projects" };
  }
  if (destination === "concierge") {
    return { href: CONCIERGE_ASK_PATH, label: "Concierge" };
  }
  return { href: CONCIERGE_HOME_PATH, label: "Today" };
}
