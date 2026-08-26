/**
 * Supabase digital-card adapter.
 * App Router / server entry: import from `./server` (enforces `server-only`).
 * Service-role only. Never writes kernel Event/Evidence/Observation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { DigitalCardStore } from "./store";
import {
  DIGITAL_CARD_EXCHANGE_EVENT_TYPE,
  DIGITAL_CARD_SOURCE_SYSTEM,
  type DigitalCard,
  type DigitalCardAdditionalLink,
  type DigitalCardContext,
  type DigitalCardContextStatus,
  type IdentityExchange,
  type IdentityExchangeResolution,
  type SubmittedContact,
} from "./types";

const CARD_COLUMNS =
  "id, owner_username, owner_person_id, slug, published, display_name, memorable_title, professional_title, company, email, email_public, phone, phone_public, website_url, linkedin_url, instagram_url, additional_links, avatar_url, source_system, created_at, updated_at";

const CONTEXT_COLUMNS =
  "id, card_id, public_token, label, status, started_at, ended_at, source_system, created_at";

const EXCHANGE_COLUMNS =
  "id, occurred_at, card_id, card_slug, context_id, owner_username, owner_person_id, counterparty_person_id, event_type, source_system, resolution_status, reason_code, submission_id, submitted_contact, created_at";

const UNIQUE_VIOLATION = "23505";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function parseLinks(value: unknown): DigitalCardAdditionalLink[] {
  if (!Array.isArray(value)) return [];
  const links: DigitalCardAdditionalLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { label?: unknown; url?: unknown };
    if (typeof record.label === "string" && typeof record.url === "string") {
      links.push({ label: record.label, url: record.url });
    }
  }
  return links;
}

function parseSubmittedContact(value: unknown): SubmittedContact {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    displayName: String(record.displayName ?? ""),
    givenName: nullableString(record.givenName),
    familyName: nullableString(record.familyName),
    email: nullableString(record.email),
    phone: nullableString(record.phone),
    company: nullableString(record.company),
    jobTitle: nullableString(record.jobTitle),
  };
}

function isContextStatus(value: unknown): value is DigitalCardContextStatus {
  return value === "draft" || value === "active" || value === "ended";
}

function isResolution(value: unknown): value is IdentityExchangeResolution {
  return value === "matched" || value === "created" || value === "review";
}

function rowToCard(row: Record<string, unknown>): DigitalCard {
  if (row.source_system !== DIGITAL_CARD_SOURCE_SYSTEM) {
    throw new Error("digital-card-source-system-invalid");
  }
  return {
    id: String(row.id),
    ownerUsername: String(row.owner_username),
    ownerPersonId: nullableString(row.owner_person_id),
    slug: String(row.slug),
    published: Boolean(row.published),
    displayName: String(row.display_name),
    memorableTitle: nullableString(row.memorable_title),
    professionalTitle: nullableString(row.professional_title),
    company: nullableString(row.company),
    email: nullableString(row.email),
    emailPublic: Boolean(row.email_public),
    phone: nullableString(row.phone),
    phonePublic: Boolean(row.phone_public),
    websiteUrl: nullableString(row.website_url),
    linkedinUrl: nullableString(row.linkedin_url),
    instagramUrl: nullableString(row.instagram_url),
    additionalLinks: parseLinks(row.additional_links),
    avatarUrl: nullableString(row.avatar_url),
    sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function cardToRow(card: DigitalCard): Record<string, unknown> {
  return {
    id: card.id,
    owner_username: card.ownerUsername,
    owner_person_id: card.ownerPersonId,
    slug: card.slug,
    published: card.published,
    display_name: card.displayName,
    memorable_title: card.memorableTitle,
    professional_title: card.professionalTitle,
    company: card.company,
    email: card.email,
    email_public: card.emailPublic,
    phone: card.phone,
    phone_public: card.phonePublic,
    website_url: card.websiteUrl,
    linkedin_url: card.linkedinUrl,
    instagram_url: card.instagramUrl,
    additional_links: card.additionalLinks,
    avatar_url: card.avatarUrl,
    source_system: DIGITAL_CARD_SOURCE_SYSTEM,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  };
}

function rowToContext(row: Record<string, unknown>): DigitalCardContext {
  if (!isContextStatus(row.status)) throw new Error("digital-card-context-status-invalid");
  if (row.source_system !== DIGITAL_CARD_SOURCE_SYSTEM) {
    throw new Error("digital-card-source-system-invalid");
  }
  return {
    id: String(row.id),
    cardId: String(row.card_id),
    publicToken: String(row.public_token),
    label: String(row.label),
    status: row.status,
    startedAt: nullableString(row.started_at),
    endedAt: nullableString(row.ended_at),
    sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
    createdAt: String(row.created_at),
  };
}

function rowToExchange(row: Record<string, unknown>): IdentityExchange {
  if (!isResolution(row.resolution_status)) {
    throw new Error("digital-card-resolution-invalid");
  }
  if (row.source_system !== DIGITAL_CARD_SOURCE_SYSTEM) {
    throw new Error("digital-card-source-system-invalid");
  }
  return {
    id: String(row.id),
    occurredAt: String(row.occurred_at),
    cardId: String(row.card_id),
    cardSlug: String(row.card_slug),
    contextId: nullableString(row.context_id),
    ownerUsername: String(row.owner_username),
    ownerPersonId: nullableString(row.owner_person_id),
    counterpartyPersonId: nullableString(row.counterparty_person_id),
    eventType: DIGITAL_CARD_EXCHANGE_EVENT_TYPE,
    sourceSystem: DIGITAL_CARD_SOURCE_SYSTEM,
    resolutionStatus: row.resolution_status,
    reasonCode: String(row.reason_code),
    submissionId: String(row.submission_id),
    submittedContact: parseSubmittedContact(row.submitted_contact),
    createdAt: String(row.created_at),
  };
}

export class SupabaseDigitalCardStore implements DigitalCardStore {
  constructor(private readonly client: SupabaseClient) {}

  async getCardById(id: string): Promise<DigitalCard | null> {
    const { data, error } = await this.client
      .from("continuum_digital_cards")
      .select(CARD_COLUMNS)
      .eq("id", id.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToCard(data) : null;
  }

  async getCardBySlug(slug: string): Promise<DigitalCard | null> {
    const { data, error } = await this.client
      .from("continuum_digital_cards")
      .select(CARD_COLUMNS)
      .eq("slug", slug.trim().toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToCard(data) : null;
  }

  async getPublishedCardBySlug(slug: string): Promise<DigitalCard | null> {
    const { data, error } = await this.client
      .from("continuum_digital_cards")
      .select(CARD_COLUMNS)
      .eq("slug", slug.trim().toLowerCase())
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToCard(data) : null;
  }

  async getCardByOwner(ownerUsername: string): Promise<DigitalCard | null> {
    const { data, error } = await this.client
      .from("continuum_digital_cards")
      .select(CARD_COLUMNS)
      .eq("owner_username", ownerUsername.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToCard(data) : null;
  }

  async upsertCard(card: DigitalCard): Promise<DigitalCard> {
    const { data, error } = await this.client
      .from("continuum_digital_cards")
      .upsert(cardToRow(card), { onConflict: "id" })
      .select(CARD_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return rowToCard(data);
  }

  async findActiveContextByPublicToken(
    cardId: string,
    token: string,
  ): Promise<DigitalCardContext | null> {
    const { data, error } = await this.client
      .from("continuum_digital_card_contexts")
      .select(CONTEXT_COLUMNS)
      .eq("card_id", cardId)
      .eq("public_token", token.trim())
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToContext(data) : null;
  }

  async upsertContext(row: DigitalCardContext): Promise<DigitalCardContext> {
    const { data, error } = await this.client
      .from("continuum_digital_card_contexts")
      .upsert(
        {
          id: row.id,
          card_id: row.cardId,
          public_token: row.publicToken,
          label: row.label,
          status: row.status,
          started_at: row.startedAt,
          ended_at: row.endedAt,
          source_system: DIGITAL_CARD_SOURCE_SYSTEM,
          created_at: row.createdAt,
        },
        { onConflict: "id" },
      )
      .select(CONTEXT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return rowToContext(data);
  }

  async insertExchange(
    row: IdentityExchange,
  ): Promise<{ status: "inserted" | "already-present"; record: IdentityExchange }> {
    const { data, error } = await this.client
      .from("continuum_identity_exchanges")
      .insert({
        id: row.id,
        occurred_at: row.occurredAt,
        card_id: row.cardId,
        card_slug: row.cardSlug,
        context_id: row.contextId,
        owner_username: row.ownerUsername,
        owner_person_id: row.ownerPersonId,
        counterparty_person_id: row.counterpartyPersonId,
        event_type: row.eventType,
        source_system: DIGITAL_CARD_SOURCE_SYSTEM,
        resolution_status: row.resolutionStatus,
        reason_code: row.reasonCode,
        submission_id: row.submissionId,
        submitted_contact: row.submittedContact,
        created_at: row.createdAt,
      })
      .select(EXCHANGE_COLUMNS)
      .single();
    if (error && error.code === UNIQUE_VIOLATION) {
      const existing = await this.getExchangeBySubmissionId(row.submissionId);
      if (existing) return { status: "already-present", record: existing };
    }
    if (error) throw new Error(error.message);
    return { status: "inserted", record: rowToExchange(data) };
  }

  async getExchangeBySubmissionId(
    submissionId: string,
  ): Promise<IdentityExchange | null> {
    const { data, error } = await this.client
      .from("continuum_identity_exchanges")
      .select(EXCHANGE_COLUMNS)
      .eq("submission_id", submissionId.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToExchange(data) : null;
  }

  async listExchangesByCard(cardId: string): Promise<IdentityExchange[]> {
    const { data, error } = await this.client
      .from("continuum_identity_exchanges")
      .select(EXCHANGE_COLUMNS)
      .eq("card_id", cardId)
      .order("occurred_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToExchange);
  }
}

export function createSupabaseDigitalCardStore(
  client?: SupabaseClient | null,
): SupabaseDigitalCardStore {
  return new SupabaseDigitalCardStore(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
