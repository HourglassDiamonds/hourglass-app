/**
 * Deterministic Calendar source-link writer after founder approval.
 * The Human Intake source-link writer requires a Human Source UUID and
 * cannot safely accept Calendar refs. This store writes confirmed
 * Calendar event → Person/Project links only.
 * Does not mint People, merge People, change Kind/lifecycle, or create jobs.
 */

export type CalendarSourceLinkEntityKind = "person" | "project";

export type CalendarSourceLink = {
  sourceRef: string;
  calendarId: string;
  calendarEventId: string;
  entityId: string;
  entityKind: CalendarSourceLinkEntityKind;
  linkStatus: "confirmed";
  participantEmailHash: string | null;
  createdAt: string;
};

export type CalendarParticipantMapping = {
  emailHash: string;
  personId: string;
  confirmedAt: string;
};

export type ConfirmCalendarSourceLinkInput = {
  sourceRef: string;
  calendarId: string;
  calendarEventId: string;
  entityId: string;
  entityKind: CalendarSourceLinkEntityKind;
  participantEmailHash?: string | null;
  createdAt: string;
};

export type ConfirmCalendarParticipantMappingInput = {
  emailHash: string;
  personId: string;
  confirmedAt: string;
};

export type CalendarAssociationWriter = {
  confirmSourceLink(
    input: ConfirmCalendarSourceLinkInput,
  ): Promise<"inserted" | "already-present">;
  listLinksForSource(sourceRef: string): Promise<CalendarSourceLink[]>;
  listLinks(): Promise<CalendarSourceLink[]>;
  confirmParticipantMapping(
    input: ConfirmCalendarParticipantMappingInput,
  ): Promise<"inserted" | "already-present">;
  listParticipantMappings(): Promise<CalendarParticipantMapping[]>;
};

function cloneLink(row: CalendarSourceLink): CalendarSourceLink {
  return { ...row };
}

function cloneMapping(row: CalendarParticipantMapping): CalendarParticipantMapping {
  return { ...row };
}

export class InMemoryCalendarAssociationWriter implements CalendarAssociationWriter {
  private readonly links = new Map<string, CalendarSourceLink>();
  private readonly mappings = new Map<string, CalendarParticipantMapping>();

  async confirmSourceLink(
    input: ConfirmCalendarSourceLinkInput,
  ): Promise<"inserted" | "already-present"> {
    const key = `${input.sourceRef}|${input.entityKind}|${input.entityId}`;
    const existing = this.links.get(key);
    if (existing) return "already-present";
    this.links.set(key, {
      sourceRef: input.sourceRef,
      calendarId: input.calendarId,
      calendarEventId: input.calendarEventId,
      entityId: input.entityId,
      entityKind: input.entityKind,
      linkStatus: "confirmed",
      participantEmailHash: input.participantEmailHash ?? null,
      createdAt: input.createdAt,
    });
    return "inserted";
  }

  async listLinksForSource(sourceRef: string): Promise<CalendarSourceLink[]> {
    return [...this.links.values()]
      .filter((row) => row.sourceRef === sourceRef)
      .map(cloneLink);
  }

  async listLinks(): Promise<CalendarSourceLink[]> {
    return [...this.links.values()].map(cloneLink);
  }

  async confirmParticipantMapping(
    input: ConfirmCalendarParticipantMappingInput,
  ): Promise<"inserted" | "already-present"> {
    const emailHash = input.emailHash.trim();
    const personId = input.personId.trim();
    if (!emailHash || !personId) return "already-present";
    const key = `${emailHash}|${personId}`;
    if (this.mappings.has(key)) return "already-present";
    this.mappings.set(key, {
      emailHash,
      personId,
      confirmedAt: input.confirmedAt,
    });
    return "inserted";
  }

  async listParticipantMappings(): Promise<CalendarParticipantMapping[]> {
    return [...this.mappings.values()].map(cloneMapping);
  }
}

export function worldLinksFromWriter(rows: readonly CalendarSourceLink[]) {
  return rows.map((row) => ({
    sourceRef: row.sourceRef,
    calendarId: row.calendarId,
    calendarEventId: row.calendarEventId,
    entityId: row.entityId,
    entityKind: row.entityKind,
    participantEmailHash: row.participantEmailHash,
  }));
}

export function worldMappingsFromWriter(
  rows: readonly CalendarParticipantMapping[],
) {
  return rows.map((row) => ({
    emailHash: row.emailHash,
    personId: row.personId,
  }));
}
