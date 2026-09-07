"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  reviewIntakeCandidateAction,
  type ReviewIntakeCandidateState,
} from "../intake-review-actions";
import type { HumanIntakeCandidateReviewView } from "@/lib/continuum/human-intake/review/preview";
import {
  humanIntakeCandidateTypeLabel,
  humanIntakeReviewLabel,
} from "@/lib/continuum/human-intake/candidates/present";
import { OPEN_JOB_ACTORS, OPEN_JOB_KINDS } from "@/lib/continuum/client-memory/project-jobs/types";

export function IntakeCandidateReviewList({
  sourceId,
  reviews,
}: {
  sourceId: string;
  reviews: HumanIntakeCandidateReviewView[];
}) {
  if (reviews.length === 0) {
    return (
      <p className="mt-4 text-[15px] leading-relaxed text-[#9a8e82]">
        No candidates extracted yet. Nothing here is memory until you approve
        it.
      </p>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-white/[0.06]">
      {reviews.map((review) => (
        <li key={review.candidateId} className="py-5">
          <IntakeCandidateReviewForm sourceId={sourceId} review={review} />
        </li>
      ))}
    </ul>
  );
}

function IntakeCandidateReviewForm({
  sourceId,
  review,
}: {
  sourceId: string;
  review: HumanIntakeCandidateReviewView;
}) {
  const { preview } = review;
  const [state, formAction, pending] = useActionState(
    reviewIntakeCandidateAction,
    null as ReviewIntakeCandidateState,
  );
  const [editing, setEditing] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const value = review.payload;

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  const locked =
    review.reviewStatus === "approved" || review.reviewStatus === "discarded";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="candidateId" value={review.candidateId} />
      <input type="hidden" name="mutationId" value={review.mutationId} />
      {review.suggestedPersonId && !editing ? (
        <input type="hidden" name="personId" value={review.suggestedPersonId} />
      ) : null}
      {review.suggestedProjectId && !editing ? (
        <input type="hidden" name="projectId" value={review.suggestedProjectId} />
      ) : null}

      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        {humanIntakeCandidateTypeLabel(review.candidateType)}
        {" · "}
        {humanIntakeReviewLabel(review.reviewStatus)}
        {" · "}
        {review.candidateState}
        {" · "}
        {review.confidence}
      </p>
      <p className="text-[15px] leading-relaxed text-[#efe8de]">{review.summary}</p>
      <p className="text-[13px] leading-relaxed text-[#9a8e82]">
        Source {review.sourceSystem} · {review.sourceRef}
      </p>
      <p className="text-[13px] leading-relaxed text-[#c6b8a8]">
        Matched because: {review.evidenceRuleIds.join(", ") || "observed text"}
      </p>
      {review.matchedText ? (
        <p className="text-[14px] leading-relaxed text-[#efe8de]">
          Observed: {review.matchedText}
        </p>
      ) : null}
      <p className="text-[14px] leading-relaxed text-[#d8cfc4]">{preview.summary}</p>
      {preview.conflict ? (
        <p className="text-[13px] leading-relaxed text-[#d2b8a8]">
          Conflict: current “{preview.currentValue ?? ""}” vs proposed “
          {preview.proposedValue ?? ""}”. Approving will overwrite the current
          canonical value.
        </p>
      ) : null}

      {editing && !locked ? (
        <div className="space-y-3">
          {value.kind === "note" ? (
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                Note
              </span>
              <textarea
                name="noteText"
                defaultValue={value.text}
                rows={4}
                className="mt-2 min-h-[6rem] w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 py-3 text-[16px] text-[#efe8de] outline-none"
              />
            </label>
          ) : null}
          {value.kind === "structured_spec" ? (
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                Proposed value
              </span>
              <input
                name="specValue"
                defaultValue={value.proposedValue}
                className="mt-2 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none"
              />
            </label>
          ) : null}
          {value.kind === "open_job" ? (
            <>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  Open Job kind
                </span>
                <select
                  name="jobKind"
                  defaultValue={value.jobKind}
                  className="mt-2 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
                >
                  {OPEN_JOB_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  Subject
                </span>
                <input
                  name="jobSubject"
                  defaultValue={value.subject}
                  className="mt-2 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  Waiting on
                </span>
                <select
                  name="waitingOnActor"
                  defaultValue={value.waitingOnActor}
                  className="mt-2 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none"
                >
                  {OPEN_JOB_ACTORS.map((actor) => (
                    <option key={actor} value={actor}>
                      {actor}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Person id
            </span>
            <input
              name="personId"
              defaultValue={review.suggestedPersonId ?? ""}
              className="mt-2 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Project id
            </span>
            <input
              name="projectId"
              defaultValue={review.suggestedProjectId ?? ""}
              className="mt-2 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none"
            />
          </label>
        </div>
      ) : null}

      {state?.message ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="text-[14px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {state.message}
        </p>
      ) : null}

      {locked ? null : (
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="action"
            value="approve"
            disabled={pending || !preview.canApply}
            className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none disabled:opacity-50"
          >
            {pending ? "Saving…" : "Approve"}
          </button>
          <button
            type="button"
            className="min-h-12 rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Hide edit" : "Edit"}
          </button>
          {editing ? (
            <button
              type="submit"
              name="action"
              value="edit"
              disabled={pending}
              className="min-h-12 rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none disabled:opacity-50"
            >
              Save edit
            </button>
          ) : null}
          <button
            type="submit"
            name="action"
            value="defer"
            disabled={pending}
            className="min-h-12 rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none disabled:opacity-50"
          >
            Later
          </button>
          <button
            type="submit"
            name="action"
            value="discard"
            disabled={pending}
            className="min-h-12 rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      )}
    </form>
  );
}
