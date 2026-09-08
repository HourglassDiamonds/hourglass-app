/**
 * Server-only Calendar association writer + directory loader.
 * Founder session required. Fail closed to an empty world.
 * Does not broaden Calendar OAuth or fetch event descriptions.
 */

import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { createSupabaseCalendarAssociationWriter } from "./server";
import type { CalendarAssociationWriter } from "./writer";
import {
  worldLinksFromWriter,
  worldMappingsFromWriter,
} from "./writer";
import type {
  CalendarAssociationPerson,
  CalendarAssociationProject,
  CalendarAssociationWorld,
} from "./types";

export type AuthenticatedCalendarAssociationWriter =
  | { ok: true; writer: CalendarAssociationWriter; username: string }
  | { ok: false; reason: "unauthorized" | "unavailable" | "not-activated" };

export async function getAuthenticatedCalendarAssociationWriter(): Promise<AuthenticatedCalendarAssociationWriter> {
  const jar = await cookies();
  const session = requireInternalClientMemorySession(
    jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (!session.ok) return { ok: false, reason: "unauthorized" };
  try {
    return {
      ok: true,
      writer: createSupabaseCalendarAssociationWriter(),
      username: session.username,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function emptyCalendarAssociationWorld(): CalendarAssociationWorld {
  return {
    people: [],
    projects: [],
    confirmedLinks: [],
    confirmedParticipantMappings: [],
    internalEmailHashes: [],
  };
}

export async function loadCalendarAssociationWorld(
  writer?: CalendarAssociationWriter | null,
): Promise<CalendarAssociationWorld> {
  const world = emptyCalendarAssociationWorld();
  const client = getSupabaseAdmin();
  if (!client) {
    if (!writer) return world;
    return {
      ...world,
      confirmedLinks: worldLinksFromWriter(await writer.listLinks()),
      confirmedParticipantMappings: worldMappingsFromWriter(
        await writer.listParticipantMappings(),
      ),
    };
  }

  let people: CalendarAssociationPerson[] = [];
  let projects: CalendarAssociationProject[] = [];
  try {
    const [{ data: profiles }, { data: identities }, { data: projectRows }, { data: history }, { data: relationships }] =
      await Promise.all([
        client
          .from("continuum_person_profiles")
          .select("person_id, display_name"),
        client
          .from("continuum_external_identities")
          .select("entity_id, identity_kind, identifier, revoked_at")
          .eq("identity_kind", "email_hash")
          .is("revoked_at", null),
        client
          .from("continuum_project_profiles")
          .select("project_id, display_title"),
        client
          .from("continuum_project_history")
          .select("project_id, cad_job_number, order_number"),
        client
          .from("continuum_relationships")
          .select("from_entity_id, to_entity_id, kind, status")
          .eq("kind", "client-project")
          .eq("status", "active"),
      ]);

    const emailByPerson = new Map<string, string>();
    for (const row of identities ?? []) {
      const personId = String(
        (row as { entity_id?: string }).entity_id ?? "",
      ).trim();
      const hash = String(
        (row as { identifier?: string }).identifier ?? "",
      ).trim();
      if (personId && hash) emailByPerson.set(personId, hash);
    }
    const projectIdsByPerson = new Map<string, string[]>();
    const personIdsByProject = new Map<string, string[]>();
    for (const row of relationships ?? []) {
      const from = String(
        (row as { from_entity_id?: string }).from_entity_id ?? "",
      ).trim();
      const to = String(
        (row as { to_entity_id?: string }).to_entity_id ?? "",
      ).trim();
      if (!from || !to) continue;
      const personFirst = emailByPerson.has(from) || (profiles ?? []).some(
        (p) => String((p as { person_id?: string }).person_id) === from,
      );
      const personId = personFirst ? from : to;
      const projectId = personFirst ? to : from;
      const peopleList = projectIdsByPerson.get(personId) ?? [];
      peopleList.push(projectId);
      projectIdsByPerson.set(personId, peopleList);
      const projectList = personIdsByProject.get(projectId) ?? [];
      projectList.push(personId);
      personIdsByProject.set(projectId, projectList);
    }
    const historyByProject = new Map<
      string,
      { cad: string | null; order: string | null }
    >();
    for (const row of history ?? []) {
      const projectId = String(
        (row as { project_id?: string }).project_id ?? "",
      ).trim();
      if (!projectId) continue;
      historyByProject.set(projectId, {
        cad:
          (row as { cad_job_number?: string | null }).cad_job_number == null
            ? null
            : String((row as { cad_job_number?: string }).cad_job_number),
        order:
          (row as { order_number?: string | null }).order_number == null
            ? null
            : String((row as { order_number?: string }).order_number),
      });
    }
    people = (profiles ?? []).flatMap((row) => {
      const personId = String(
        (row as { person_id?: string }).person_id ?? "",
      ).trim();
      const displayName = String(
        (row as { display_name?: string }).display_name ?? "",
      ).trim();
      if (!personId || !displayName) return [];
      return [
        {
          personId,
          displayName,
          emailHash: emailByPerson.get(personId) ?? null,
          projectIds: projectIdsByPerson.get(personId) ?? [],
        },
      ];
    });
    projects = (projectRows ?? []).flatMap((row) => {
      const projectId = String(
        (row as { project_id?: string }).project_id ?? "",
      ).trim();
      const title = String(
        (row as { display_title?: string }).display_title ?? "",
      ).trim();
      if (!projectId || !title) return [];
      const spec = historyByProject.get(projectId);
      return [
        {
          projectId,
          title,
          cadJobNumber: spec?.cad ?? null,
          orderNumber: spec?.order ?? null,
          personIds: personIdsByProject.get(projectId) ?? [],
          founderApprovedCurrent: true,
        },
      ];
    });
  } catch {
    people = [];
    projects = [];
  }

  let confirmedLinks = world.confirmedLinks;
  let confirmedParticipantMappings = world.confirmedParticipantMappings;
  if (writer) {
    try {
      confirmedLinks = worldLinksFromWriter(await writer.listLinks());
      confirmedParticipantMappings = worldMappingsFromWriter(
        await writer.listParticipantMappings(),
      );
    } catch {
      confirmedLinks = [];
      confirmedParticipantMappings = [];
    }
  }

  return {
    people,
    projects,
    confirmedLinks,
    confirmedParticipantMappings,
    internalEmailHashes: [],
  };
}
