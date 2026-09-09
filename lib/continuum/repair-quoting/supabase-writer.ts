/**
 * Supabase repair-quote founder writer.
 * Service-role only. Import from `./server`.
 * Does not write Gmail, Human Intake, CoS, operating details, or book catalogs.
 */

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { civilDateInZone } from "@/lib/continuum/date-only";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import type { EntityKind } from "@/lib/continuum/contracts/types";
import type { PersonProfile, ProjectProfile } from "@/lib/continuum/client-memory/types";
import { projectKindFromUnknown } from "@/lib/continuum/client-memory/project-kind";
import { createRepairQuote } from "./create";
import type { CreateRepairQuoteInput, CreateRepairQuoteResult } from "./create";
import {
  issueRepairQuote,
  overrideRepairQuote,
  voidRepairQuote,
  type ApplyRepairQuoteMutationInput,
  type MutateRepairQuoteResult,
} from "./mutate";
import {
  REPAIR_QUOTE_COLUMNS,
  repairQuoteMutationToRow,
  repairQuoteToRow,
  rowToRepairQuote,
} from "./rows";
import type { RepairQuote } from "./types";
import type { RepairQuoteWriter } from "./writer";

function requireClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error("supabase-admin-unavailable");
  return client;
}

function writeReason(message: string): Error {
  if (message.includes("project-not-found")) return new Error("project-not-found");
  if (message.includes("quote-not-found")) return new Error("quote-not-found");
  if (message.includes("entity-kind-mismatch")) {
    return new Error("entity-kind-mismatch");
  }
  return new Error(message || "mutate-repair-quote-failed");
}

export class SupabaseRepairQuoteWriter implements RepairQuoteWriter {
  constructor(private readonly client: SupabaseClient) {}

  private async getEntityKind(
    id: string,
  ): Promise<{ kind: EntityKind } | null> {
    const { data, error } = await this.client
      .from("continuum_entities")
      .select("kind")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { kind: data.kind as EntityKind };
  }

  private async getProjectProfile(
    projectId: string,
  ): Promise<ProjectProfile | null> {
    const { data, error } = await this.client
      .from("continuum_project_profiles")
      .select(
        "project_id, display_title, visibility, import_row_key, source_system, created_at, updated_at, project_kind",
      )
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      projectId: String(data.project_id),
      displayTitle: String(data.display_title),
      visibility: data.visibility as ProjectProfile["visibility"],
      importRowKey:
        data.import_row_key == null ? null : String(data.import_row_key),
      sourceSystem: data.source_system as ProjectProfile["sourceSystem"],
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
      projectKind: projectKindFromUnknown(data.project_kind),
    };
  }

  private async getPersonProfile(
    personId: string,
  ): Promise<PersonProfile | null> {
    const { data, error } = await this.client
      .from("continuum_person_profiles")
      .select("person_id, display_name")
      .eq("person_id", personId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      personId: String(data.person_id),
      displayName: String(data.display_name),
      givenName: null,
      familyName: null,
      organizationName: null,
      email: null,
      phone: null,
      streetAddress: null,
      city: null,
      state: null,
      country: null,
      postalCode: null,
      roles: ["client"],
      sourceSystem: "concierge-manual",
      createdAt: "",
      updatedAt: "",
    };
  }

  private async hasActiveClientProjectRelationship(
    projectId: string,
    personId: string,
  ): Promise<boolean> {
    const forward = await this.client
      .from("continuum_relationships")
      .select("id")
      .eq("kind", "client-project")
      .eq("status", "active")
      .eq("from_entity_id", personId)
      .eq("to_entity_id", projectId)
      .limit(1);
    if (forward.error) throw forward.error;
    if ((forward.data ?? []).length > 0) return true;
    const reverse = await this.client
      .from("continuum_relationships")
      .select("id")
      .eq("kind", "client-project")
      .eq("status", "active")
      .eq("from_entity_id", projectId)
      .eq("to_entity_id", personId)
      .limit(1);
    if (reverse.error) throw reverse.error;
    return (reverse.data ?? []).length > 0;
  }

  private async loadQuote(quoteId: string): Promise<RepairQuote | null> {
    const { data, error } = await this.client
      .from("continuum_repair_quotes")
      .select(REPAIR_QUOTE_COLUMNS)
      .eq("quote_id", quoteId)
      .maybeSingle();
    if (error) throw writeReason(error.message);
    return rowToRepairQuote((data ?? null) as Record<string, unknown> | null);
  }

  private async findByMutationId(mutationId: string): Promise<RepairQuote | null> {
    const existing = await this.client
      .from("continuum_repair_quote_mutations")
      .select("quote_id")
      .eq("mutation_id", mutationId)
      .maybeSingle();
    if (existing.error) throw writeReason(existing.error.message);
    if (!existing.data?.quote_id) return null;
    return this.loadQuote(String(existing.data.quote_id));
  }

  private async nextQuoteNumber(projectId: string): Promise<number> {
    const { data, error } = await this.client
      .from("continuum_repair_quotes")
      .select("quote_number")
      .eq("project_id", projectId)
      .order("quote_number", { ascending: false })
      .limit(1);
    if (error) throw writeReason(error.message);
    const current = Number(data?.[0]?.quote_number ?? 0);
    return (Number.isInteger(current) ? current : 0) + 1;
  }

  private async applyCreate(quote: RepairQuote) {
    const existingMutation = await this.findByMutationId(quote.createdMutationId);
    if (existingMutation) {
      return { status: "already-present" as const, quote: existingMutation };
    }
    const inserted = await this.client
      .from("continuum_repair_quotes")
      .insert(repairQuoteToRow(quote));
    if (inserted.error) throw writeReason(inserted.error.message);
    const mutation = await this.client
      .from("continuum_repair_quote_mutations")
      .insert(
        repairQuoteMutationToRow({
          mutationId: quote.createdMutationId,
          quoteId: quote.quoteId,
          projectId: quote.projectId,
          action: "create",
          priorState: null,
          newState: quote.state,
          priorHourglassQuoteCents: null,
          newHourglassQuoteCents: quote.calculation.hourglassQuoteCents,
          changedAt: quote.createdAt,
          changedBy: quote.createdBy,
        }),
      );
    if (mutation.error) throw writeReason(mutation.error.message);
    return { status: "created" as const, quote };
  }

  private async applyMutation(input: ApplyRepairQuoteMutationInput) {
    const existing = await this.findByMutationId(input.mutation.mutationId);
    if (existing) return { status: "already-present" as const, quote: existing };
    const updated = await this.client
      .from("continuum_repair_quotes")
      .update(repairQuoteToRow(input.next))
      .eq("quote_id", input.next.quoteId)
      .eq("project_id", input.next.projectId);
    if (updated.error) throw writeReason(updated.error.message);
    const mutation = await this.client
      .from("continuum_repair_quote_mutations")
      .insert(repairQuoteMutationToRow(input.mutation));
    if (mutation.error) throw writeReason(mutation.error.message);
    return { status: "applied" as const, quote: input.next };
  }

  async getQuote(projectId: string, quoteId: string): Promise<RepairQuote | null> {
    const quote = await this.loadQuote(quoteId);
    if (!quote || quote.projectId !== projectId) return null;
    return quote;
  }

  async listQuotes(projectId: string): Promise<RepairQuote[]> {
    const { data, error } = await this.client
      .from("continuum_repair_quotes")
      .select(REPAIR_QUOTE_COLUMNS)
      .eq("project_id", projectId)
      .order("quote_number", { ascending: false });
    if (error) throw writeReason(error.message);
    return (data ?? []).flatMap((row) => {
      const mapped = rowToRepairQuote(row as Record<string, unknown>);
      return mapped ? [mapped] : [];
    });
  }

  createQuote(input: CreateRepairQuoteInput): Promise<CreateRepairQuoteResult> {
    const nowIso = () => new Date().toISOString();
    return createRepairQuote(
      {
        nowIso,
        newQuoteId: () => randomUUID(),
        quoteDate: () => civilDateInZone(nowIso()) ?? nowIso().slice(0, 10),
        getEntity: (id) => this.getEntityKind(id),
        getProjectProfile: (projectId) => this.getProjectProfile(projectId),
        getPersonProfile: (personId) => this.getPersonProfile(personId),
        hasActiveClientProjectRelationship: (projectId, personId) =>
          this.hasActiveClientProjectRelationship(projectId, personId),
        nextQuoteNumber: (projectId) => this.nextQuoteNumber(projectId),
        findByMutationId: (mutationId) => this.findByMutationId(mutationId),
        applyCreate: (quote) => this.applyCreate(quote),
      },
      input,
    );
  }

  issueQuote(input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    actor: string;
  }): Promise<MutateRepairQuoteResult> {
    return issueRepairQuote(
      {
        nowIso: () => new Date().toISOString(),
        getQuote: (quoteId) => this.loadQuote(quoteId),
        findByMutationId: (mutationId) => this.findByMutationId(mutationId),
        applyMutation: (row) => this.applyMutation(row),
      },
      input,
    );
  }

  overrideQuote(input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    amountCents: number;
    reason: string;
    actor: string;
  }): Promise<MutateRepairQuoteResult> {
    return overrideRepairQuote(
      {
        nowIso: () => new Date().toISOString(),
        getQuote: (quoteId) => this.loadQuote(quoteId),
        findByMutationId: (mutationId) => this.findByMutationId(mutationId),
        applyMutation: (row) => this.applyMutation(row),
      },
      input,
    );
  }

  voidQuote(input: {
    mutationId: string;
    projectId: string;
    quoteId: string;
    actor: string;
  }): Promise<MutateRepairQuoteResult> {
    return voidRepairQuote(
      {
        nowIso: () => new Date().toISOString(),
        getQuote: (quoteId) => this.loadQuote(quoteId),
        findByMutationId: (mutationId) => this.findByMutationId(mutationId),
        applyMutation: (row) => this.applyMutation(row),
      },
      input,
    );
  }
}

export function createSupabaseRepairQuoteWriter(
  client?: SupabaseClient | null,
): RepairQuoteWriter {
  return new SupabaseRepairQuoteWriter(
    requireClient(client === undefined ? getSupabaseAdmin() : client),
  );
}
