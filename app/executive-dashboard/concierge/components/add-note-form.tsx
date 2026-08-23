"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import {
  saveManualConciergeNote,
  type SaveManualNoteState,
} from "../actions";
import {
  RELATIONSHIP_CONTEXT_LAYER_LABELS,
  conciergeClientPath,
} from "@/lib/continuum/client-memory/read/presentation";
import {
  RELATIONSHIP_CONTEXT_LAYERS,
  type RelationshipContextLayer,
} from "@/lib/continuum/client-memory/types";

type LinkedProjectOption = {
  id: string;
  title: string;
};

export function AddNoteForm({
  personId,
  personName,
  submissionId,
  defaultContext,
  projects,
}: {
  personId: string;
  personName: string;
  submissionId: string;
  defaultContext: RelationshipContextLayer | null;
  projects: LinkedProjectOption[];
}) {
  const noteId = useId();
  const projectId = useId();
  const [state, formAction, pending] = useActionState(
    saveManualConciergeNote,
    null as SaveManualNoteState | null,
  );
  const [contextLayer, setContextLayer] = useState<RelationshipContextLayer | "">(
    defaultContext ?? "",
  );
  const errorRef = useRef<HTMLParagraphElement>(null);
  const showProjects = contextLayer === "client" && projects.length > 0;

  useEffect(() => {
    if (state?.message) errorRef.current?.focus();
  }, [state?.message]);

  return (
    <form action={formAction} className="flex min-h-[70vh] flex-col" noValidate>
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="submissionId" value={submissionId} />

      <p className="text-[15px] leading-relaxed text-[#c4b7aa]">{personName}</p>

      <fieldset className="mt-8 border-0 p-0">
        <legend className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
          Context
        </legend>
        <div
          className="hg-concierge-segments mt-3"
          role="radiogroup"
          aria-label="Relationship context"
        >
          {RELATIONSHIP_CONTEXT_LAYERS.map((layer) => {
            const selected = contextLayer === layer;
            return (
              <label
                key={layer}
                className={`hg-concierge-segment ${selected ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="contextLayer"
                  value={layer}
                  checked={selected}
                  required
                  onChange={() => setContextLayer(layer)}
                />
                <span>{RELATIONSHIP_CONTEXT_LAYER_LABELS[layer]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 flex-1">
        <label
          htmlFor={noteId}
          className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
        >
          Note
        </label>
        <textarea
          id={noteId}
          name="noteText"
          required
          maxLength={10000}
          rows={10}
          enterKeyHint="enter"
          className="mt-3 min-h-[12rem] w-full resize-y rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 py-3 text-[16px] leading-relaxed text-[#efe8de] outline-none placeholder:text-[#7d7268] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </div>

      {showProjects ? (
        <div className="mt-6">
          <label
            htmlFor={projectId}
            className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]"
          >
            Related project
          </label>
          <select
            id={projectId}
            name="projectId"
            defaultValue=""
            className="mt-3 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[15px] text-[#efe8de] outline-none focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
          >
            <option value="">None</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

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
          disabled={pending || !contextLayer}
          className="min-h-12 flex-1 rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Note"}
        </button>
        <Link
          href={conciergeClientPath(personId)}
          className="inline-flex min-h-12 min-w-[6.5rem] items-center justify-center rounded-[18px] px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
