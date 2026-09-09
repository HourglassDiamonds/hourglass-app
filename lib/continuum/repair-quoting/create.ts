/**
 * Create a project-linked repair quote draft from Geller Cost columns.
 * Does not infer prices from operating details, notes, or Gmail.
 */

import type { ClientMemoryEntity, PersonProfile, ProjectProfile } from "@/lib/continuum/client-memory/types";
import { GELLER_BLUE_BOOK } from "./contract";
import { lookupCatalogSku } from "./catalog";
import { calculateRepairQuote } from "./calculate";
import {
  isRepairMetalFamily,
  isRepairQuoteType,
  isRepairQuoteUuid,
  parseCreatedBy,
  parseOverrideReason,
  parseSku,
  parseTaskDescription,
} from "./validate";
import type {
  RepairQuote,
  RepairQuoteInvalidCode,
  RepairQuoteLineInput,
} from "./types";
import type { GellerSourceAmounts } from "./source";

export type CreateRepairQuoteInput = {
  mutationId: string;
  projectId: string;
  repairType: string;
  metalFamily: string;
  associatedPersonId?: string | null;
  line: RepairQuoteLineInput;
  overrideAmountCents?: number | null;
  overrideReason?: string | null;
  actor: string;
};

export type CreateRepairQuoteResult =
  | { ok: true; status: "created" | "already-present"; quote: RepairQuote }
  | {
      ok: false;
      reason: "invalid-input" | "project-not-found" | "entity-kind-mismatch" | "unavailable";
      code?: RepairQuoteInvalidCode;
    };

export type CreateRepairQuoteDeps = {
  nowIso: () => string;
  newQuoteId: () => string;
  quoteDate: () => string;
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getProjectProfile: (projectId: string) => Promise<ProjectProfile | null>;
  getPersonProfile: (personId: string) => Promise<PersonProfile | null>;
  hasActiveClientProjectRelationship: (
    projectId: string,
    personId: string,
  ) => Promise<boolean>;
  nextQuoteNumber: (projectId: string) => Promise<number>;
  findByMutationId: (mutationId: string) => Promise<RepairQuote | null>;
  applyCreate: (quote: RepairQuote) => Promise<{ status: "created" | "already-present"; quote: RepairQuote }>;
};

function invalid(code: RepairQuoteInvalidCode): Extract<CreateRepairQuoteResult, { ok: false }> {
  return { ok: false, reason: "invalid-input", code };
}

export async function createRepairQuote(
  deps: CreateRepairQuoteDeps,
  input: CreateRepairQuoteInput,
): Promise<CreateRepairQuoteResult> {
  const mutationId = input.mutationId.trim();
  const projectId = input.projectId.trim();
  if (!isRepairQuoteUuid(mutationId) || !isRepairQuoteUuid(projectId)) {
    return invalid("invalid-id");
  }
  if (!isRepairQuoteType(input.repairType)) return invalid("invalid-repair-type");
  if (!isRepairMetalFamily(input.metalFamily)) return invalid("invalid-metal");
  const createdBy = parseCreatedBy(input.actor);
  if (!createdBy) return invalid("invalid-id");
  const associatedPersonId = input.associatedPersonId?.trim() || null;
  if (associatedPersonId && !isRepairQuoteUuid(associatedPersonId)) {
    return invalid("invalid-id");
  }
  if (!parseSku(input.line?.sku) || !parseTaskDescription(input.line?.taskDescription)) {
    return invalid("invalid-source-line");
  }

  const catalog = lookupCatalogSku(input.line.sku);
  if (!catalog) return invalid("invalid-source-line");
  const line = {
    ...input.line,
    sku: catalog.sku,
    taskDescription: catalog.taskDescription,
    amounts: catalog.amounts,
    metalSemantics: catalog.metalSemantics,
    metalBand: input.line.metalBand ?? null,
  };

  const calculated = calculateRepairQuote({
    repairType: input.repairType,
    metalFamily: input.metalFamily,
    line,
    overrideAmountCents: input.overrideAmountCents ?? null,
    overrideReason: input.overrideReason ?? null,
  });
  if (!calculated.ok) return invalid(calculated.code);

  let override = null;
  if (input.overrideAmountCents != null) {
    const reason = parseOverrideReason(input.overrideReason);
    if (!reason) return invalid("invalid-override");
    override = {
      amountCents: input.overrideAmountCents,
      reason,
      overriddenBy: createdBy,
      overriddenAt: deps.nowIso(),
    };
  }

  try {
    const existing = await deps.findByMutationId(mutationId);
    if (existing) return { ok: true, status: "already-present", quote: existing };

    const entity = await deps.getEntity(projectId);
    if (!entity) return { ok: false, reason: "project-not-found" };
    if (entity.kind !== "project") return { ok: false, reason: "entity-kind-mismatch" };
    const profile = await deps.getProjectProfile(projectId);
    if (!profile || profile.projectId !== projectId) {
      return { ok: false, reason: "project-not-found" };
    }
    if (profile.projectKind !== "repair_service") return invalid("project-not-repair");
    if (associatedPersonId) {
      const person = await deps.getPersonProfile(associatedPersonId);
      if (!person || person.personId !== associatedPersonId) {
        return invalid("person-not-on-project");
      }
      const linked = await deps.hasActiveClientProjectRelationship(
        projectId,
        associatedPersonId,
      );
      if (!linked) return invalid("person-not-on-project");
    }

    const now = deps.nowIso();
    const quote: RepairQuote = {
      quoteId: deps.newQuoteId(),
      projectId,
      quoteNumber: await deps.nextQuoteNumber(projectId),
      state: "draft",
      repairType: input.repairType,
      metalFamily: input.metalFamily,
      associatedPersonId,
      sourceEditionLabel: GELLER_BLUE_BOOK.editionLabel,
      sourceSku: calculated.calculation.sourceSku,
      line: calculated.calculation.line,
      calculation: calculated.calculation,
      override,
      issuedAt: null,
      issuedBy: null,
      voidedAt: null,
      voidedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy,
      createdMutationId: mutationId,
      issuedMutationId: null,
    };
    const result = await deps.applyCreate(quote);
    return { ok: true, status: result.status, quote: result.quote };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("project-not-found")) {
      return { ok: false, reason: "project-not-found" };
    }
    if (message.includes("entity-kind-mismatch")) {
      return { ok: false, reason: "entity-kind-mismatch" };
    }
    return { ok: false, reason: "unavailable" };
  }
}

export function lineFromForm(input: {
  sku: string;
  taskDescription: string;
  amounts: GellerSourceAmounts;
  inventedMetalQuantity?: boolean;
  expressSelected?: boolean;
  goldUsdPerOz?: number | null;
  millidwt?: number | null;
  metalSemantics?: RepairQuoteLineInput["metalSemantics"];
  costBasis?: RepairQuoteLineInput["costBasis"];
}): RepairQuoteLineInput {
  const catalog = lookupCatalogSku(input.sku);
  return {
    sku: input.sku,
    taskDescription: catalog?.taskDescription ?? input.taskDescription,
    amounts: catalog?.amounts ?? input.amounts,
    metalBand: null,
    hasExplicitMetalQuantity: input.millidwt != null && input.millidwt > 0,
    inventedMetalQuantity: input.inventedMetalQuantity === true,
    expressSelected: input.expressSelected === true,
    goldUsdPerOz: input.goldUsdPerOz ?? null,
    millidwt: input.millidwt ?? null,
    metalSensitive:
      input.goldUsdPerOz != null && input.millidwt != null
        ? { goldUsdPerOz: input.goldUsdPerOz, millidwt: input.millidwt }
        : null,
    metalSemantics: catalog?.metalSemantics ?? input.metalSemantics ?? null,
    costBasis: input.costBasis ?? "geller_cost_columns",
  };
}
