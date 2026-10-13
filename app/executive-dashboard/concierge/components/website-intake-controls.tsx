"use client";

import { useActionState, useState } from "react";
import type { ClientWebsiteIntake } from "@/lib/continuum/client-memory/read/website-intake";
import {
  closeWebsiteIntake,
  confirmWebsiteIntakeCorrespondence,
  type WebsiteIntakeActionState,
} from "../website-intake-actions";

export function WebsiteIntakeControls({ intake }: { intake: ClientWebsiteIntake }) {
  const [review, setReview] = useState<"dismiss" | "established" | null>(null);
  const [association, associateAction, associationPending] = useActionState<WebsiteIntakeActionState, FormData>(confirmWebsiteIntakeCorrespondence, null);
  const [closure, closeAction, closurePending] = useActionState<WebsiteIntakeActionState, FormData>(closeWebsiteIntake, null);
  const correspondence = intake.correspondenceReview;
  return (
    <section className="mt-5 border-t border-white/[0.08] pt-4" data-website-intake-controls="">
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
        <form action={closeAction} className="rounded-sm border border-[#4a4136] p-3">
          <input type="hidden" name="intakeId" value={intake.intakeId} />
          <input type="hidden" name="disposition" value={review} />
          <p className="text-[12px] leading-relaxed text-[#c4b7aa]">
            {review === "dismiss"
              ? "Approve dismissal from the active queue. The submission and audit history will not be deleted, and replay remains idempotent."
              : "Approve moving this established prospect out of New Intake. This does not confirm a sale or create a Project."}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="submit" disabled={closurePending} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">
              {closurePending ? "Saving…" : "Approve"}
            </button>
            <button type="button" disabled={closurePending} onClick={() => setReview(null)} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#8d8073]">Keep active</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => setReview("dismiss")} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#8d8073]">Review dismissal</button>
          {correspondence?.status === "approved" ? <button type="button" onClick={() => setReview("established")} className="min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">Review established intake</button> : null}
        </div>
      )}
      {closure?.message ? <p role={closure.ok ? "status" : "alert"} className="mt-3 text-[12px] text-[#c4b7aa]">{closure.message}</p> : null}
    </section>
  );
}
