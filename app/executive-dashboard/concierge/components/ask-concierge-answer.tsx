import Link from "next/link";
import { CosViewEmailControl } from "./cos-source-viewer";
import {
  ASK_ERROR_MESSAGE,
  ASK_UNSUPPORTED_DETAIL,
  ASK_UNSUPPORTED_MESSAGE,
  askBirthdaysByMonthHeadline,
  formatAskBirthdayDate,
  type AskConciergeAnswer,
} from "@/lib/continuum/client-memory/ask/types";
import { conciergeClientPath } from "@/lib/continuum/client-memory/read/presentation";
import type { ConciergeSolAnswer } from "@/lib/continuum/concierge-sol/types";
import type { SterlingResponse } from "@/lib/continuum/sterling/types";
import { SterlingProposalControls } from "./sterling-proposal-controls";

export type AskAnswer = AskConciergeAnswer | ConciergeSolAnswer;

export function AskConciergeAnswerView({ answer }: { answer: AskAnswer }) {
  if (answer.kind === "conversation") {
    return <ConversationAnswer answer={answer} />;
  }
  if (answer.kind === "error") {
    return (
      <p className="mt-4 text-[14px] leading-relaxed text-[#c4b7aa]" role="status">
        {ASK_ERROR_MESSAGE}
      </p>
    );
  }

  if (answer.kind === "unsupported") {
    return (
      <div className="mt-4" role="status">
        <p className="text-[14px] leading-relaxed text-[#c4b7aa]">{ASK_UNSUPPORTED_MESSAGE}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-[#7d7268]">
          {ASK_UNSUPPORTED_DETAIL}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-[14px] leading-relaxed text-[#c4b7aa]" role="status">
        {askBirthdaysByMonthHeadline(answer.month, answer.people.length)}
      </p>
      {answer.people.length > 0 ? (
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {answer.people.map((person) => (
            <li key={person.factId}>
              <Link
                href={conciergeClientPath(person.personId)}
                className="block min-h-14 rounded-[18px] px-1 py-4 outline-none transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:shadow-[0_0_0_2px_#987648]"
              >
                <p className="font-serif text-[1.28rem] leading-[1.15] tracking-[-0.03em] text-[#efe8de]">
                  {person.displayName}
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#b7aa9c]">
                  {formatAskBirthdayDate(person)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ConversationAnswer({ answer }: { answer: ConciergeSolAnswer }) {
  const emailActions = answer.actions.filter((row) => row.kind === "view-email");
  const linkActions = answer.actions.filter((row) => row.kind !== "view-email");
  return (
    <div className="hg-concierge-sol-answer mt-4" data-concierge-sol-answer="" data-ask-mode={answer.mode}>
      <p
        className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#d8cfc4]"
        role="status"
      >
        {answer.text}
      </p>
      {answer.sterling ? <SterlingAnswer response={answer.sterling} /> : null}
      {answer.brainDump ? (
        <dl className="mt-4 grid gap-2 text-[13px] leading-relaxed text-[#b7aa9c]" data-brain-dump="">
          {answer.brainDump.personContext ? (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-[#8d8073]">Person</dt>
              <dd>{answer.brainDump.personContext}</dd>
            </div>
          ) : null}
          {answer.brainDump.projectContext ? (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-[#8d8073]">Project</dt>
              <dd>{answer.brainDump.projectContext}</dd>
            </div>
          ) : null}
          {answer.brainDump.action ? (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-[#8d8073]">Action</dt>
              <dd>{answer.brainDump.action}</dd>
            </div>
          ) : null}
          {answer.brainDump.personalItem ? (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-[#8d8073]">Personal</dt>
              <dd>{answer.brainDump.personalItem}</dd>
            </div>
          ) : null}
          {answer.brainDump.note ? (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-[#8d8073]">Note</dt>
              <dd>{answer.brainDump.note}</dd>
            </div>
          ) : null}
          {answer.brainDump.followUp ? (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.22em] text-[#8d8073]">Follow-up</dt>
              <dd>{answer.brainDump.followUp}</dd>
            </div>
          ) : null}
          <p className="mt-1 text-[12px] text-[#7d7268]">Nothing has been saved.</p>
        </dl>
      ) : null}
      {linkActions.length > 0 || emailActions.length > 0 ? (
        <div className="mt-4 flex flex-col items-start gap-2">
          {linkActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
            >
              {action.label}
            </Link>
          ))}
          {emailActions.map((action) => (
            <CosViewEmailControl
              key={action.href}
              sources={[{ href: action.href, label: action.label }]}
              request={{
                sources: [{ href: action.href, label: action.label }],
                personLabel: null,
                projectTitle: null,
                why: null,
                facts: [],
                beats: [],
                provenanceLimited: action.provenanceLimited === true,
                provenanceLabel: action.provenanceLabel ?? null,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SterlingAnswer({ response }: { response: SterlingResponse }) {
  return (
    <div className="mt-5 space-y-4" data-sterling-response={response.kind}>
      {response.priorities.length > 0 ? (
        <ol className="space-y-3" aria-label="Sterling priorities">
          {response.priorities.map((priority, index) => (
            <li
              key={priority.id}
              className="border-t border-white/[0.06] py-4 first:border-t-0"
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#ad9164]">
                {index + 1} · {priority.owner} · {priority.confidence} confidence
              </p>
              <h3 className="mt-2 font-serif text-[1.2rem] leading-tight text-[#efe8de]">
                {priority.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#c4b7aa]">
                {priority.whyNow}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#d8cfc4]">
                Next: {priority.proposedNextAction}
              </p>
              <EvidenceDetails
                evidence={[priority.evidenceSummary, ...priority.sourceRefs]}
                canonicalIds={priority.canonicalIds}
              />
            </li>
          ))}
        </ol>
      ) : null}

      {response.findings.length > 0 ? (
        <ul className="space-y-3" aria-label="Sterling findings">
          {response.findings.map((finding) => (
            <li key={finding.id} className="border-t border-white/[0.06] pt-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#ad9164]">
                {finding.kind}
              </p>
              <h3 className="mt-2 text-[15px] leading-snug text-[#efe8de]">{finding.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#c4b7aa]">
                {finding.whyItMatters}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#d8cfc4]">
                Proposed fix: {finding.proposedFix}
              </p>
              {finding.proposal ? (
                <article className="mt-4 border-l border-[#ad9164]/35 pl-4" data-sterling-inline-proposal="">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#ad9164]">Suggested cleanup</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#efe8de]">{finding.proposal.proposedState}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#8d8073]">{finding.proposal.reason}</p>
                  <details className="mt-2 text-[11px] leading-relaxed text-[#80746a]">
                    <summary className="cursor-pointer">What changes</summary>
                    <p className="mt-1">{finding.proposal.expectedDownstreamEffect}</p>
                    <p className="mt-1">Current: {finding.proposal.currentState}</p>
                  </details>
                  <SterlingProposalControls proposal={finding.proposal} />
                </article>
              ) : null}
              <EvidenceDetails evidence={finding.evidence} canonicalIds={[]} />
            </li>
          ))}
        </ul>
      ) : null}

      {response.uncertainty.map((line) => (
        <p key={line} className="text-[12px] leading-relaxed text-[#8d8073]">
          Uncertainty: {line}
        </p>
      ))}
    </div>
  );
}

function EvidenceDetails({
  evidence,
  canonicalIds,
}: {
  evidence: readonly string[];
  canonicalIds: readonly string[];
}) {
  void canonicalIds;
  const rows = [...evidence].filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <details className="mt-3 text-[12px] leading-relaxed text-[#8d8073]">
      <summary className="cursor-pointer text-[#ad9164]">Evidence</summary>
      <ul className="mt-2 space-y-1">
        {rows.map((row, index) => <li key={`${row}-${index}`}>{row}</li>)}
      </ul>
    </details>
  );
}
