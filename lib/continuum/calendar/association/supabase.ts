/**
 * Durable Calendar association writer against UNAPPLIED #23 tables.
 * Service-role only. Does not write Persons, Kind, lifecycle, or Open Jobs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type {
  CalendarAssociationWriter,
  CalendarParticipantMapping,
  CalendarSourceLink,
  ConfirmCalendarParticipantMappingInput,
  ConfirmCalendarSourceLinkInput,
} from "./writer";

export const CONTINUUM_CALENDAR_SOURCE_LINKS_TABLE =
  "continuum_calendar_source_links" as const;
export const CONTINUUM_CALENDAR_PARTICIPANT_MAPPINGS_TABLE =
  "continuum_calendar_participant_mappings" as const;

const UNIQUE_VIOLATION = "23505";
const LINK_COLUMNS =
  "source_ref, calendar_id, calendar_event_id, entity_id, entity_kind, link_status, participant_email_hash, created_at";
const MAPPING_COLUMNS = "email_hash, person_id, confirmed_at";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function throwIfError(error: { code?: string; message?: string } | null): void {
  if (!error) return;
  const message = (error.message ?? "").toLowerCase();
  if (
    error.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  ) {
    throw new Error("calendar-association-not-activated");
  }
  throw new Error(error.message || "calendar-association-unavailable");
}

function rowToLink(row: Record<string, unknown>): CalendarSourceLink {
  return {
    sourceRef: String(row.source_ref ?? ""),
    calendarId: String(row.calendar_id ?? ""),
    calendarEventId: String(row.calendar_event_id ?? ""),
    entityId: String(row.entity_id ?? ""),
    entityKind: row.entity_kind === "project" ? "project" : "person",
    linkStatus: "confirmed",
    participantEmailHash:
      row.participant_email_hash == null
        ? null
        : String(row.participant_email_hash),
    createdAt: String(row.created_at ?? ""),
  };
}

function rowToMapping(row: Record<string, unknown>): CalendarParticipantMapping {
  return {
    emailHash: String(row.email_hash ?? ""),
    personId: String(row.person_id ?? ""),
    confirmedAt: String(row.confirmed_at ?? ""),
  };
}

export class SupabaseCalendarAssociationWriter implements CalendarAssociationWriter {
  constructor(private readonly client: SupabaseClient) {}

  async confirmSourceLink(
    input: ConfirmCalendarSourceLinkInput,
  ): Promise<"inserted" | "already-present"> {
    const { error } = await this.client
      .from(CONTINUUM_CALENDAR_SOURCE_LINKS_TABLE)
      .insert({
        source_ref: input.sourceRef,
        calendar_id: input.calendarId,
        calendar_event_id: input.calendarEventId,
        entity_id: input.entityId,
        entity_kind: input.entityKind,
        link_status: "confirmed",
        participant_email_hash: input.participantEmailHash ?? null,
        created_at: input.createdAt,
      });
    if (error?.code === UNIQUE_VIOLATION) return "already-present";
    throwIfError(error);
    return "inserted";
  }

  async listLinksForSource(sourceRef: string): Promise<CalendarSourceLink[]> {
    const { data, error } = await this.client
      .from(CONTINUUM_CALENDAR_SOURCE_LINKS_TABLE)
      .select(LINK_COLUMNS)
      .eq("source_ref", sourceRef.trim())
      .order("created_at", { ascending: true });
    throwIfError(error);
    return (data ?? []).map((row) => rowToLink(row as Record<string, unknown>));
  }

  async listLinks(): Promise<CalendarSourceLink[]> {
    const { data, error } = await this.client
      .from(CONTINUUM_CALENDAR_SOURCE_LINKS_TABLE)
      .select(LINK_COLUMNS)
      .order("created_at", { ascending: true });
    throwIfError(error);
    return (data ?? []).map((row) => rowToLink(row as Record<string, unknown>));
  }

  async confirmParticipantMapping(
    input: ConfirmCalendarParticipantMappingInput,
  ): Promise<"inserted" | "already-present"> {
    const { error } = await this.client
      .from(CONTINUUM_CALENDAR_PARTICIPANT_MAPPINGS_TABLE)
      .insert({
        email_hash: input.emailHash,
        person_id: input.personId,
        confirmed_at: input.confirmedAt,
      });
    if (error?.code === UNIQUE_VIOLATION) return "already-present";
    throwIfError(error);
    return "inserted";
  }

  async listParticipantMappings(): Promise<CalendarParticipantMapping[]> {
    const { data, error } = await this.client
      .from(CONTINUUM_CALENDAR_PARTICIPANT_MAPPINGS_TABLE)
      .select(MAPPING_COLUMNS)
      .order("confirmed_at", { ascending: true });
    throwIfError(error);
    return (data ?? []).map((row) => rowToMapping(row as Record<string, unknown>));
  }
}

export function createSupabaseCalendarAssociationWriter(
  client: SupabaseClient | null = getSupabaseAdmin(),
): SupabaseCalendarAssociationWriter {
  return new SupabaseCalendarAssociationWriter(requireClient(client));
}
