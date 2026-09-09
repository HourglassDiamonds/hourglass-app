"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedRepairQuoteWriter } from "@/lib/continuum/repair-quoting/load-writer";
import { lineFromForm } from "@/lib/continuum/repair-quoting/create";
import type { CreateRepairQuoteResult } from "@/lib/continuum/repair-quoting/create";
import type { MutateRepairQuoteResult } from "@/lib/continuum/repair-quoting/mutate";
import {
  parseDwtToMillidwt,
  parseGoldUsdPerOz,
  parseOptionalUsdCents,
  parseUsdCentsField,
} from "@/lib/continuum/repair-quoting/validate";
import {
  conciergeRepairQuotePath,
  conciergeRepairQuotesPath,
} from "@/lib/continuum/client-memory/read/presentation";
import type { RepairMetalFamily, RepairQuoteType } from "@/lib/continuum/repair-quoting/types";

export type SaveRepairQuoteState = { ok: false; message: string } | null;

function humanCreateMessage(result: CreateRepairQuoteResult): string {
  if (result.ok) return "Unable to save the repair quote.";
  if (result.code === "retail-used-as-cost") {
    return "Geller Price columns are retail. Hourglass quotes from Cost columns only.";
  }
  if (result.code === "express-not-enabled") {
    return "Express is source context only. Hourglass does not apply it yet.";
  }
  if (result.code === "invented-metal-quantity" || result.code === "missing-metal-quantity") {
    return "Do not invent metal quantity. Use the sourced task cost, or a source dwt.";
  }
  if (result.code === "platinum-dynamic-blocked") {
    return "Platinum has no synthetic dynamic model in V1.";
  }
  if (result.code === "fourteen-k-metal-only") {
    return "Dynamic metal uses published 14K Geller bands only.";
  }
  if (result.code === "project-not-repair") {
    return "Repair quotes are only for Repair / Service projects.";
  }
  if (result.reason === "project-not-found" || result.reason === "entity-kind-mismatch") {
    return "That project could not be found.";
  }
  return "Unable to save the repair quote.";
}

function humanMutateMessage(result: MutateRepairQuoteResult): string {
  if (result.ok) return "Unable to update the repair quote.";
  if (result.code === "issued-quote-immutable") {
    return "Issued quotes stay frozen. Create a new quote instead of repricing.";
  }
  if (result.code === "invalid-override") {
    return "Add an override amount and reason.";
  }
  return "Unable to update the repair quote.";
}

export async function saveRepairQuote(
  _prev: SaveRepairQuoteState,
  formData: FormData,
): Promise<SaveRepairQuoteState> {
  const auth = await getAuthenticatedRepairQuoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the repair quote.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const repairType = String(formData.get("repairType") ?? "").trim() as RepairQuoteType;
  const metalFamily = String(formData.get("metalFamily") ?? "").trim() as RepairMetalFamily;
  const costBasis = String(formData.get("costBasis") ?? "").trim();
  const result = await auth.writer.createQuote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    repairType,
    metalFamily,
    associatedPersonId: String(formData.get("associatedPersonId") ?? "").trim() || null,
    line: lineFromForm({
      sku: String(formData.get("sourceSku") ?? ""),
      taskDescription: String(formData.get("taskDescription") ?? ""),
      amounts: {
        priceLaborCents: parseUsdCentsField(String(formData.get("priceLabor") ?? "")) ?? 0,
        pricePartsCents: parseUsdCentsField(String(formData.get("priceParts") ?? "")) ?? 0,
        priceOtherCents: parseUsdCentsField(String(formData.get("priceOther") ?? "")) ?? 0,
        costLaborCents: parseUsdCentsField(String(formData.get("costLabor") ?? "")) ?? 0,
        costPartsCents: parseUsdCentsField(String(formData.get("costParts") ?? "")) ?? 0,
        costOtherCents: parseUsdCentsField(String(formData.get("costOther") ?? "")) ?? 0,
      },
      inventedMetalQuantity: String(formData.get("inventedMetalQuantity") ?? "") === "yes",
      expressSelected: String(formData.get("expressSelected") ?? "") === "yes",
      goldUsdPerOz: parseGoldUsdPerOz(String(formData.get("goldUsdPerOz") ?? "")),
      millidwt: parseDwtToMillidwt(String(formData.get("metalDwt") ?? "")),
      costBasis:
        costBasis === "geller_price_columns"
          ? "geller_price_columns"
          : "geller_cost_columns",
    }),
    overrideAmountCents: parseOptionalUsdCents(String(formData.get("overrideAmount") ?? "")),
    overrideReason: String(formData.get("overrideReason") ?? "").trim() || null,
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeRepairQuotePath(projectId, result.quote.quoteId)}?saved=quote`);
  }
  return { ok: false, message: humanCreateMessage(result) };
}

export async function issueSavedRepairQuote(
  _prev: SaveRepairQuoteState,
  formData: FormData,
): Promise<SaveRepairQuoteState> {
  const auth = await getAuthenticatedRepairQuoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to issue the repair quote.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const result = await auth.writer.issueQuote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    quoteId,
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeRepairQuotePath(projectId, quoteId)}?saved=issued`);
  }
  return { ok: false, message: humanMutateMessage(result) };
}

export async function overrideSavedRepairQuote(
  _prev: SaveRepairQuoteState,
  formData: FormData,
): Promise<SaveRepairQuoteState> {
  const auth = await getAuthenticatedRepairQuoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to override the repair quote.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  const amountCents = parseOptionalUsdCents(String(formData.get("overrideAmount") ?? ""));
  if (amountCents == null) {
    return { ok: false, message: "Add an override amount and reason." };
  }
  const result = await auth.writer.overrideQuote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    quoteId,
    amountCents,
    reason: String(formData.get("overrideReason") ?? ""),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeRepairQuotePath(projectId, quoteId)}?saved=override`);
  }
  return { ok: false, message: humanMutateMessage(result) };
}

export async function voidSavedRepairQuote(
  _prev: SaveRepairQuoteState,
  formData: FormData,
): Promise<SaveRepairQuoteState> {
  const auth = await getAuthenticatedRepairQuoteWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to void the repair quote.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const result = await auth.writer.voidQuote({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    quoteId: String(formData.get("quoteId") ?? "").trim(),
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeRepairQuotesPath(projectId)}?saved=voided`);
  }
  return { ok: false, message: humanMutateMessage(result) };
}
