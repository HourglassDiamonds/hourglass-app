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
  SOURCE_PRICE_SEMANTICS,
} from "@/lib/continuum/repair-quoting/types";
import {
  REPAIR_METAL_LABELS,
  REPAIR_QUOTE_TYPE_LABELS,
  SOURCE_SEMANTICS_LABELS,
} from "@/lib/continuum/repair-quoting/present";
import { defaultGoldSensitive } from "@/lib/continuum/repair-quoting/calculate";

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
  const semanticsId = useId();
  const [repairType, setRepairType] = useState<(typeof REPAIR_QUOTE_TYPES)[number]>("sizing");
  const [metalFamily, setMetalFamily] =
    useState<(typeof REPAIR_METAL_FAMILIES)[number]>("gold_14k");
  const [semantics, setSemantics] = useState<string>("");
  const [state, formAction, pending] = useActionState(
    saveRepairQuote,
    null as SaveRepairQuoteState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  const goldDefault = defaultGoldSensitive({ repairType, metalFamily });

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="mutationId" value={mutationId} />
      <p className="text-[15px] leading-relaxed text-[#c4b7aa]">{projectTitle}</p>
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Founder quote · not a public calculator
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
          Blue Book / source edition
        </span>
        <input
          name="sourceEditionLabel"
          required
          maxLength={120}
          placeholder="Edition and version as printed"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <fieldset className="mt-8" aria-describedby={semanticsId}>
        <legend
          id={semanticsId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Book number means
        </legend>
        <div className="hg-project-kind-choice mt-3">
          {SOURCE_PRICE_SEMANTICS.map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="sourcePriceSemantics"
                value={value}
                checked={semantics === value}
                onChange={() => setSemantics(value)}
              />
              <span className="min-w-0 break-words text-[15px] leading-relaxed">
                {SOURCE_SEMANTICS_LABELS[value]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Source line
        </span>
        <input
          name="sourceLineRef"
          required
          maxLength={80}
          placeholder="Book code / page line"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Source description
        </span>
        <input
          name="sourceLineLabel"
          required
          maxLength={160}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Source amount
        </span>
        <input
          name="sourceAmount"
          required
          inputMode="decimal"
          placeholder="0.00"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      <fieldset className="mt-8">
        <legend className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Gold-sensitive
        </legend>
        <div className="hg-project-kind-choice mt-3" key={`${repairType}-${metalFamily}`}>
          <label>
            <input type="radio" name="goldSensitive" value="yes" defaultChecked={goldDefault} />
            <span className="text-[15px] leading-relaxed">Yes — metal adjusts with gold</span>
          </label>
          <label>
            <input type="radio" name="goldSensitive" value="no" defaultChecked={!goldDefault} />
            <span className="text-[15px] leading-relaxed">No — labor / non-gold</span>
          </label>
        </div>
      </fieldset>

      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Gold weight (dwt)
        </span>
        <input
          name="goldWeightDwt"
          inputMode="decimal"
          placeholder={goldDefault ? "Required for gold-sensitive work" : "If metal is added"}
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Weight kind
        </span>
        <select
          name="goldWeightKind"
          defaultValue="alloy_dwt"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        >
          <option value="alloy_dwt">Alloy dwt</option>
          <option value="fine_dwt">Fine gold dwt</option>
        </select>
      </label>

      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Current gold / oz
        </span>
        <input
          name="goldUsd"
          required
          inputMode="decimal"
          placeholder="Founder-dated gold, not a live feed"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Gold as of
        </span>
        <input
          type="date"
          name="goldAsOfDate"
          required
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
        />
      </label>
      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Book gold baseline / oz
        </span>
        <input
          name="goldBaselineUsd"
          inputMode="decimal"
          placeholder="Required when metal is gold-sensitive"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>
      <label className="mt-6 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Manual metal delta
        </span>
        <input
          name="manualMetalDelta"
          inputMode="decimal"
          placeholder="Platinum or non-gold metal only"
          className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </label>

      {semantics === "shop_cost" ? (
        <label className="mt-8 block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Hourglass markup
          </span>
          <input
            name="markupMultiple"
            inputMode="decimal"
            placeholder="e.g. 2.5 — required for shop cost"
            className="mt-2 w-full min-h-12 rounded-[18px] border border-white/10 bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
          />
        </label>
      ) : semantics === "suggested_retail" ? (
        <p className="mt-8 text-[15px] leading-relaxed text-[#c4b7aa]">
          Suggested retail is not marked up again.
        </p>
      ) : (
        <p className="mt-8 text-[15px] leading-relaxed text-[#c4b7aa]">
          Choose shop cost or suggested retail before quoting.
        </p>
      )}

      <label className="mt-8 block">
        <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Manual override
        </span>
        <input
          name="overrideAmount"
          inputMode="decimal"
          placeholder="Optional Hourglass quote"
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
