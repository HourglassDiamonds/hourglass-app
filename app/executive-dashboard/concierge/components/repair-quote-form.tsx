"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  saveRepairQuote,
  searchGellerLines,
  type SaveRepairQuoteState,
} from "../repair-quote-actions";
import { conciergeRepairQuotesPath } from "@/lib/continuum/client-memory/read/presentation";
import {
  REPAIR_METAL_FAMILIES,
  REPAIR_QUOTE_TYPES,
} from "@/lib/continuum/repair-quoting/types";
import {
  ADDITIONAL_METAL_LABEL,
  HOURGLASS_MARKUP_LABEL,
  LABOR_BURDEN_LABEL,
  LOADED_COST_LABEL,
  RAW_QUOTE_LABEL,
  REPAIR_METAL_LABELS,
  REPAIR_QUOTE_TYPE_LABELS,
  ROUNDED_QUOTE_LABEL,
  SOURCE_LABOR_LABEL,
  SOURCE_PARTS_LABEL,
  metalInclusionLabel,
} from "@/lib/continuum/repair-quoting/present";
import { GELLER_BLUE_BOOK } from "@/lib/continuum/repair-quoting/contract";
import { calculateRepairQuote } from "@/lib/continuum/repair-quoting/calculate";
import {
  allowsAdditional14kMetal,
  blocksDynamicMetalOverlay,
  replacesSourcePartsWith14kMetal,
} from "@/lib/continuum/repair-quoting/metal-semantics";
import { formatUsdCents, formatUsdEighthCents } from "@/lib/continuum/repair-quoting/money";
import { parseDwtToMillidwt, parseGoldUsdPerOz } from "@/lib/continuum/repair-quoting/validate";
import type { GellerSearchHit } from "@/lib/continuum/repair-quoting/catalog";

function centsField(cents: number): string {
  return formatUsdCents(cents).replace("$", "");
}

export function RepairQuoteForm({
  projectId,
  projectTitle,
  mutationId,
  people,
}: {
  projectId: string;
  projectTitle: string;
  mutationId: string;
  people: Array<{ personId: string; displayName: string }>;
}) {
  const typeId = useId();
  const metalId = useId();
  const [repairType, setRepairType] = useState<(typeof REPAIR_QUOTE_TYPES)[number]>("sizing");
  const [metalFamily, setMetalFamily] =
    useState<(typeof REPAIR_METAL_FAMILIES)[number]>("gold_14k");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GellerSearchHit[]>([]);
  const [unique, setUnique] = useState(false);
  const [selected, setSelected] = useState<GellerSearchHit | null>(null);
  const [goldSpot, setGoldSpot] = useState("");
  const [metalDwt, setMetalDwt] = useState("");
  const [searching, startSearch] = useTransition();
  const [state, formAction, pending] = useActionState(
    saveRepairQuote,
    null as SaveRepairQuoteState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  function runSearch(nextQuery: string) {
    startSearch(async () => {
      const result = await searchGellerLines(nextQuery);
      setHits(result.hits);
      setUnique(result.unique);
    });
  }

  function selectHit(hit: GellerSearchHit) {
    setSelected(hit);
    setRepairType(hit.inferredRepairType);
    setMetalFamily(hit.inferredMetalFamily);
    setHits([]);
    setQuery(hit.sku);
  }

  const metalFieldsVisible =
    selected != null &&
    (allowsAdditional14kMetal(selected.metalSemantics) ||
      replacesSourcePartsWith14kMetal(selected.metalSemantics));
  const overlayBlocked =
    selected != null && blocksDynamicMetalOverlay(selected.metalSemantics);

  const preview =
    selected == null
      ? null
      : calculateRepairQuote({
          repairType,
          metalFamily,
          line: {
            sku: selected.sku,
            taskDescription: selected.taskDescription,
            amounts: selected.amounts,
            metalSemantics: selected.metalSemantics,
            inventedMetalQuantity: false,
            expressSelected: false,
            goldUsdPerOz: parseGoldUsdPerOz(goldSpot),
            millidwt: parseDwtToMillidwt(metalDwt),
            metalSensitive:
              parseGoldUsdPerOz(goldSpot) != null && parseDwtToMillidwt(metalDwt) != null
                ? {
                    goldUsdPerOz: parseGoldUsdPerOz(goldSpot)!,
                    millidwt: parseDwtToMillidwt(metalDwt)!,
                  }
                : null,
            costBasis: "geller_cost_columns",
          },
        });

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      <input type="hidden" name="costBasis" value="geller_cost_columns" />
      <input type="hidden" name="sourceSku" value={selected?.sku ?? ""} />
      <input type="hidden" name="taskDescription" value={selected?.taskDescription ?? ""} />
      <input type="hidden" name="priceLabor" value={selected ? centsField(selected.amounts.priceLaborCents) : ""} />
      <input type="hidden" name="priceParts" value={selected ? centsField(selected.amounts.pricePartsCents) : ""} />
      <input type="hidden" name="priceOther" value={selected ? centsField(selected.amounts.priceOtherCents) : ""} />
      <input type="hidden" name="costLabor" value={selected ? centsField(selected.amounts.costLaborCents) : ""} />
      <input type="hidden" name="costParts" value={selected ? centsField(selected.amounts.costPartsCents) : ""} />
      <input type="hidden" name="costOther" value={selected ? centsField(selected.amounts.costOtherCents) : ""} />
      <p className="text-[15px] leading-relaxed text-[#c4b7aa]">{projectTitle}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Founder quote · {GELLER_BLUE_BOOK.editionLabel}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
        Search the Geller source catalog, choose the intended line, then inspect Cost
        columns × {LABOR_BURDEN_LABEL} labor burden and {HOURGLASS_MARKUP_LABEL}× loaded
        cost. Hourglass never silently picks an ambiguous line.
      </p>

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Search Geller
        </span>
        <input
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setSelected(null);
            if (next.trim().length >= 2) runSearch(next);
            else setHits([]);
          }}
          placeholder='14k yellow size up 1 narrow 0-4 stones'
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      {searching ? (
        <p className="mt-2 text-[13px] text-[#8d8073]">Searching source lines…</p>
      ) : null}
      {hits.length > 0 ? (
        <div className="mt-3">
          <p className="text-[13px] leading-relaxed text-[#c4b7aa]">
            {unique
              ? "One source line matches. Select it to continue."
              : "Multiple source lines match. Choose the intended Geller line."}
          </p>
          <ul className="mt-3 space-y-2">
            {hits.map((hit) => (
              <li key={hit.sku}>
                <button
                  type="button"
                  onClick={() => selectHit(hit)}
                  className="w-full rounded-[18px] border border-white/10 bg-[#1d1916] px-4 py-3 text-left text-[15px] text-[#efe8de] outline-none hover:border-[#ad9164]/50 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
                >
                  <span className="block font-serif text-[1.05rem]">SKU {hit.sku}</span>
                  <span className="mt-1 block text-[13px] text-[#c4b7aa]">
                    {hit.taskDescription}
                  </span>
                  <span className="mt-1 block text-[12px] text-[#8d8073]">
                    Cost Labor {formatUsdCents(hit.amounts.costLaborCents)} · Cost Parts{" "}
                    {formatUsdCents(hit.amounts.costPartsCents)} · {GELLER_BLUE_BOOK.editionLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {selected ? (
        <section className="mt-8 rounded-[18px] border border-white/10 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Selected source line
          </p>
          <p className="mt-2 font-serif text-[1.2rem] text-[#efe8de]">SKU {selected.sku}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-[#c4b7aa]">
            {selected.taskDescription}
          </p>
          <p className="mt-2 text-[13px] text-[#8d8073]">{GELLER_BLUE_BOOK.editionLabel}</p>
          <dl className="mt-4 space-y-2">
            <PreviewRow label="Price Labor" value={formatUsdCents(selected.amounts.priceLaborCents)} />
            <PreviewRow label="Price Parts" value={formatUsdCents(selected.amounts.pricePartsCents)} />
            <PreviewRow label="Price Other" value={formatUsdCents(selected.amounts.priceOtherCents)} />
            <PreviewRow label="Cost Labor" value={formatUsdCents(selected.amounts.costLaborCents)} />
            <PreviewRow label="Cost Parts" value={formatUsdCents(selected.amounts.costPartsCents)} />
            <PreviewRow label="Cost Other" value={formatUsdCents(selected.amounts.costOtherCents)} />
          </dl>
        </section>
      ) : (
        <p className="mt-6 text-[15px] leading-relaxed text-[#c4b7aa]">
          Choose a Geller source line before saving. Amounts come from the catalog, not
          free typing.
        </p>
      )}

      <fieldset className="mt-8" aria-describedby={typeId}>
        <legend
          id={typeId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Repair type
        </legend>
        <div className="hg-project-kind-choice mt-3">
          {REPAIR_QUOTE_TYPES.map((type) => (
            <label key={type}>
              <input
                type="radio"
                name="repairType"
                value={type}
                checked={repairType === type}
                onChange={() => setRepairType(type)}
              />
              <span className="min-w-0 break-words text-[15px] leading-relaxed">
                {REPAIR_QUOTE_TYPE_LABELS[type]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-8" aria-describedby={metalId}>
        <legend
          id={metalId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Metal
        </legend>
        <div className="hg-project-kind-choice mt-3">
          {REPAIR_METAL_FAMILIES.map((metal) => (
            <label key={metal}>
              <input
                type="radio"
                name="metalFamily"
                value={metal}
                checked={metalFamily === metal}
                onChange={() => setMetalFamily(metal)}
              />
              <span className="min-w-0 break-words text-[15px] leading-relaxed">
                {REPAIR_METAL_LABELS[metal]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {people.length > 0 ? (
        <label className="mt-8 block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Person
          </span>
          <select
            name="associatedPersonId"
            className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
            defaultValue={people[0]?.personId ?? ""}
          >
            <option value="">No person linked</option>
            {people.map((person) => (
              <option key={person.personId} value={person.personId}>
                {person.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {overlayBlocked ? (
        <p className="mt-8 text-[15px] leading-relaxed text-[#c4b7aa]">
          Source Cost Parts already includes the metal/parts for this operation. V1
          will not add a gold + dwt overlay.
        </p>
      ) : null}

      {metalFieldsVisible ? (
        <>
          <label className="mt-8 block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Gold spot / oz
            </span>
            <input
              name="goldUsdPerOz"
              inputMode="decimal"
              value={goldSpot}
              onChange={(event) => setGoldSpot(event.target.value)}
              placeholder="Optional. Published 14K band, or extrapolate above $4,049"
              className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
            />
          </label>
          <label className="mt-4 block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              14K metal quantity (dwt)
            </span>
            <input
              name="metalDwt"
              inputMode="decimal"
              value={metalDwt}
              onChange={(event) => setMetalDwt(event.target.value)}
              placeholder="Required with gold spot. Never invent weight."
              className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
            />
          </label>
        </>
      ) : null}

      {preview?.ok ? (
        <section className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Calculation
          </p>
          <dl className="mt-4 space-y-2">
            <PreviewRow
              label={SOURCE_LABOR_LABEL}
              value={formatUsdEighthCents(preview.calculation.explanation.sourceLaborEighthCents)}
            />
            <PreviewRow
              label={SOURCE_PARTS_LABEL}
              value={formatUsdEighthCents(preview.calculation.explanation.sourcePartsEighthCents)}
            />
            {metalInclusionLabel(preview.calculation.metalInclusion) ? (
              <PreviewRow
                label="Metal inclusion"
                value={metalInclusionLabel(preview.calculation.metalInclusion) ?? ""}
              />
            ) : null}
            {preview.calculation.explanation.additionalMetalEighthCents > 0 ? (
              <PreviewRow
                label={ADDITIONAL_METAL_LABEL}
                value={formatUsdEighthCents(
                  preview.calculation.explanation.additionalMetalEighthCents,
                )}
              />
            ) : null}
            <PreviewRow
              label={LOADED_COST_LABEL}
              value={formatUsdEighthCents(preview.calculation.explanation.loadedCostEighthCents)}
            />
            <PreviewRow
              label={RAW_QUOTE_LABEL}
              value={formatUsdEighthCents(preview.calculation.explanation.rawQuoteEighthCents)}
            />
            <PreviewRow
              label={ROUNDED_QUOTE_LABEL}
              value={formatUsdEighthCents(preview.calculation.explanation.roundedQuoteEighthCents)}
            />
          </dl>
        </section>
      ) : preview && !preview.ok ? (
        <p className="mt-8 text-[15px] leading-relaxed text-[#d2b8a8]">
          Fail closed: {preview.code}
        </p>
      ) : null}

      <p className="mt-8 text-[15px] leading-relaxed text-[#c4b7aa]">
        Labor burden {LABOR_BURDEN_LABEL}× and Hourglass markup {HOURGLASS_MARKUP_LABEL}×
        cost are locked. V1 rounds the raw quote to nearest $5. No minimum repair
        charge. Express is not enabled. Platinum has no synthetic dynamic model.
      </p>

      <fieldset className="mt-8">
        <legend className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Geller Express
        </legend>
        <label className="mt-3 flex min-h-11 items-start gap-3">
          <input type="checkbox" name="expressSelected" value="yes" className="mt-1" />
          <span className="text-[15px] leading-relaxed text-[#c4b7aa]">
            Apply Express. Hourglass does not enable this yet; selecting it fails closed.
          </span>
        </label>
      </fieldset>

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Manual override
        </span>
        <input
          name="overrideAmount"
          inputMode="decimal"
          placeholder="Optional issued amount"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Override reason
        </span>
        <input
          name="overrideReason"
          maxLength={240}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      {state?.message ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-6 text-[14px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {state.message}
        </p>
      ) : null}

      <div className="hg-concierge-savebar sticky bottom-0 z-10 mt-8 -mx-5 flex gap-3 bg-[#14110f] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={pending || !selected || (preview != null && !preview.ok)}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save draft quote"}
        </button>
        <Link
          href={conciergeRepairQuotesPath(projectId)}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">{label}</dt>
      <dd className="mt-1 text-[15px] leading-relaxed text-[#e7ddd2]">{value}</dd>
    </div>
  );
}
