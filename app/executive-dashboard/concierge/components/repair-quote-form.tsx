"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  saveRepairQuote,
  type SaveRepairQuoteState,
} from "../repair-quote-actions";
import { conciergeRepairQuotesPath } from "@/lib/continuum/client-memory/read/presentation";
import {
  REPAIR_METAL_FAMILIES,
  REPAIR_QUOTE_TYPES,
} from "@/lib/continuum/repair-quoting/types";
import {
  HOURGLASS_MARKUP_LABEL,
  LABOR_BURDEN_LABEL,
  REPAIR_METAL_LABELS,
  REPAIR_QUOTE_TYPE_LABELS,
} from "@/lib/continuum/repair-quoting/present";
import { GELLER_BLUE_BOOK } from "@/lib/continuum/repair-quoting/contract";
import { lookupVerifiedSku } from "@/lib/continuum/repair-quoting/source";
import { formatUsdCents } from "@/lib/continuum/repair-quoting/money";

function centsField(cents: number): string {
  return cents === 0 ? "" : formatUsdCents(cents).replace("$", "");
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
  const [sku, setSku] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [priceLabor, setPriceLabor] = useState("");
  const [priceParts, setPriceParts] = useState("");
  const [priceOther, setPriceOther] = useState("");
  const [costLabor, setCostLabor] = useState("");
  const [costParts, setCostParts] = useState("");
  const [costOther, setCostOther] = useState("");
  const [state, formAction, pending] = useActionState(
    saveRepairQuote,
    null as SaveRepairQuoteState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  function applySku(nextSku: string) {
    setSku(nextSku);
    const verified = lookupVerifiedSku(nextSku);
    if (!verified) return;
    setRepairType(verified.repairType);
    setMetalFamily(verified.metalFamily);
    setTaskDescription(verified.taskDescription);
    setPriceLabor(centsField(verified.amounts.priceLaborCents));
    setPriceParts(centsField(verified.amounts.pricePartsCents));
    setPriceOther(centsField(verified.amounts.priceOtherCents));
    setCostLabor(centsField(verified.amounts.costLaborCents));
    setCostParts(centsField(verified.amounts.costPartsCents));
    setCostOther(centsField(verified.amounts.costOtherCents));
  }

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      <input type="hidden" name="costBasis" value="geller_cost_columns" />
      <p className="text-[15px] leading-relaxed text-[#c4b7aa]">{projectTitle}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Founder quote · {GELLER_BLUE_BOOK.editionLabel}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
        Hourglass uses Cost columns × {LABOR_BURDEN_LABEL} labor burden, then{" "}
        {HOURGLASS_MARKUP_LABEL}× that loaded cost. Geller Price columns are retail
        provenance only.
      </p>

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
            {people.map((person) => (
              <option key={person.personId} value={person.personId}>
                {person.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Source SKU
        </span>
        <input
          name="sourceSku"
          required
          maxLength={40}
          value={sku}
          onChange={(event) => applySku(event.target.value)}
          placeholder="Geller task SKU"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Source task
        </span>
        <input
          name="taskDescription"
          required
          maxLength={240}
          value={taskDescription}
          onChange={(event) => setTaskDescription(event.target.value)}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Geller Price — retail provenance
      </p>
      <label className="mt-4 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Price Labor
        </span>
        <input
          name="priceLabor"
          inputMode="decimal"
          value={priceLabor}
          onChange={(event) => setPriceLabor(event.target.value)}
          placeholder="0.00"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Price Parts
        </span>
        <input
          name="priceParts"
          inputMode="decimal"
          value={priceParts}
          onChange={(event) => setPriceParts(event.target.value)}
          placeholder="0.00"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Price Other
        </span>
        <input
          name="priceOther"
          inputMode="decimal"
          value={priceOther}
          onChange={(event) => setPriceOther(event.target.value)}
          placeholder="0.00"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Geller Cost — Hourglass basis
      </p>
      <label className="mt-4 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Cost Labor
        </span>
        <input
          name="costLabor"
          inputMode="decimal"
          value={costLabor}
          onChange={(event) => setCostLabor(event.target.value)}
          placeholder="0.00"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Cost Parts
        </span>
        <input
          name="costParts"
          inputMode="decimal"
          value={costParts}
          onChange={(event) => setCostParts(event.target.value)}
          placeholder="0.00"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Cost Other
        </span>
        <input
          name="costOther"
          inputMode="decimal"
          value={costOther}
          onChange={(event) => setCostOther(event.target.value)}
          placeholder="0.00"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <p className="mt-8 text-[15px] leading-relaxed text-[#c4b7aa]">
        Labor burden {LABOR_BURDEN_LABEL}× and Hourglass markup {HOURGLASS_MARKUP_LABEL}×
        cost are locked. Rounding, minimum charge, Express, and platinum dynamic
        material remain unresolved.
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
          disabled={pending}
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
