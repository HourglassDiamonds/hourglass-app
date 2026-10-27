"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ClientWebsiteIntake } from "@/lib/continuum/client-memory/read/website-intake";
import { conciergeProjectPath } from "@/lib/continuum/client-memory/read/presentation";
import {
  confirmWebsiteIntakeCorrespondence,
  transitionWebsiteIntakeLifecycle,
  type WebsiteIntakeActionState,
} from "../website-intake-actions";

export function WebsiteIntakeControls({ intake }: { intake: ClientWebsiteIntake }) {
  const [review, setReview] = useState<"test_submission" | "solicitation" | "contacted" | "new" | null>(null);
  const [association, associateAction, associationPending] = useActionState<WebsiteIntakeActionState, FormData>(confirmWebsiteIntakeCorrespondence, null);
  const [transition, transitionAction, transitionPending] = useActionState<WebsiteIntakeActionState, FormData>(transitionWebsiteIntakeLifecycle, null);
  const correspondence = intake.correspondenceReview;
  const active = intake.lifecycle.disposition === "new" && Boolean(intake.lifecycle.activeJobId);
  return (
    <section className="mt-5 border-t border-white/[0.08] pt-4" data-website-intake-controls="">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">Lifecycle</p>
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#ad9164]">{intake.lifecycle.label}</p>
      </div>
      {intake.lifecycle.projectId ? (
        <p className="mb-4 text-[12px] leading-relaxed text-[#c4b7aa]">
          Opportunity: <Link className="text-[#ad9164] underline-offset-4 hover:underline" href={conciergeProjectPath(intake.lifecycle.projectId)}>{intake.lifecycle.projectTitle ?? "Open Project"}</Link>
          {intake.lifecycle.projectStage ? ` · ${intake.lifecycle.projectStage.replaceAll("_", " ")}` : ""}
        </p>
      ) : null}
      {correspondence?.status === "pending" ? (
        <form action={associateAction} className="mb-4">
          <input type="hidden" name="intakeId" value={intake.intakeId} />
          <input type="hidden" name="candidateId" value={correspondence.candidateId} />
          <p className="text-[12px] leading-relaxed text-[#c4b7aa]">
            Indexed Gmail correspondence matches this intake’s exact hashed address. Founder confirmation is required before it can be linked to the existing prospect.
          </p>
          <button type="submit" disabled={associationPending} className="mt-3 min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">
            {associationPending ? "Confirming…" : "Confirm correspondence"}
          </button>
        </form>
      ) : correspondence?.status === "approved" ? (
        <p className="mb-4 text-[12px] leading-relaxed text-[#9eb69b]">Correspondence is founder-confirmed for this prospect.</p>
      ) : null}
      {association?.message ? <p role={association.ok ? "status" : "alert"} className="mb-3 text-[12px] text-[#c4b7aa]">{association.message}</p> : null}
      {review ? (
        <form action={transitionAction} className="rounded-sm border border-[#4a4136] p-3">
          <input type="hidden" name="intakeId" value={intake.intakeId} />
          <input type="hidden" name="disposition" value={review} />
          <p className="text-[12px] leading-relaxed text-[#c4b7aa]">
            {review === "contacted"
              ? "Approve creating a Discovery-stage opportunity and a Waiting on Client action. Exact-address correspondence must be confirmed first when available. This records the founder’s contact declaration; it does not fabricate an email or a sale."
              : review === "new"
                ? "Restore this preserved inquiry to New Concierge. Its prior disposition and audit history remain intact."
                : `Approve classifying this as ${review === "test_submission" ? "a test submission" : "a solicitation"}. The Person and inquiry history remain preserved.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="submit" disabled={transitionPending} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">
              {transitionPending ? "Saving…" : "Approve"}
            </button>
            <button type="button" disabled={transitionPending} onClick={() => setReview(null)} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#8d8073]">Cancel</button>
          </div>
        </form>
      ) : active ? (
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => setReview("contacted")} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">Mark contacted</button>
          <button type="button" onClick={() => setReview("test_submission")} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#8d8073]">Mark test</button>
          <button type="button" onClick={() => setReview("solicitation")} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#8d8073]">Mark solicitation</button>
        </div>
      ) : intake.lifecycle.disposition === "test_submission" || intake.lifecycle.disposition === "solicitation" ? (
        <button type="button" onClick={() => setReview("new")} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">Restore to New Concierge</button>
      ) : (
        <p className="text-[12px] leading-relaxed text-[#8d8073]">Use the linked Project to review or reverse its audited lifecycle stage.</p>
      )}
      {transition?.message ? <p role={transition.ok ? "status" : "alert"} className="mt-3 text-[12px] text-[#c4b7aa]">{transition.message}</p> : null}
    </section>
  );
}
