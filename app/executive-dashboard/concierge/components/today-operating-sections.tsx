"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import type {
  CosTodaySectionItem,
  CosTodaySectionView,
} from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import type { ClientWebsiteIntake } from "@/lib/continuum/client-memory/read/website-intake";
import {
  websiteIntakeFields,
  websiteIntakeSubmittedLabel,
  websiteIntakeWhatMatters,
} from "@/lib/continuum/client-memory/read/website-intake-presentation";

type SterlingAction = (input: {
  query: string;
  mode: "conversation";
  businessTodayContext: string;
  todayTarget?: {
    itemId: string;
    label: string;
    projectId: string | null;
    jobId: string | null;
  };
}) => Promise<{
  kind?: string;
  text?: string;
  writesCanonical?: boolean;
  refreshToday?: boolean;
}>;

type OptimisticMove = "remove" | "production" | "waiting_client" | "watching" | null;

function intendedMove(query: string): OptimisticMove {
  if (/\b(?:dead|spam|delivered|complete|completed|done|closed|lost)\b/i.test(query)) return "remove";
  if (/\b(?:manufacturing|in production)\b/i.test(query)) return "production";
  if (/\b(?:already (?:emailed|replied|responded|followed up)|i (?:emailed|replied to|responded to))\b/i.test(query)) return "waiting_client";
  if (/\b(?:backburner|back burner|held|deferred|put .* on hold)\b/i.test(query)) return "watching";
  if (/\b(?:need to do|do|bring|snooze) (?:this|it).*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(query)) return "watching";
  return null;
}

function targetFor(query: string, sections: readonly CosTodaySectionView[]): CosTodaySectionItem | null {
  const folded = query.toLowerCase();
  const items = sections.flatMap((section) => section.items);
  return items.find((item) => {
    const words = item.title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
    return words.some((word) => folded.includes(word));
  }) ?? null;
}

function applyOptimistic(
  sections: readonly CosTodaySectionView[],
  target: CosTodaySectionItem,
  move: Exclude<OptimisticMove, null>,
): CosTodaySectionView[] {
  const without = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.id !== target.id),
  }));
  if (move === "remove") return without;
  return without.map((section) =>
    section.id === move
      ? { ...section, items: [{ ...target, stateLabel: move === "production" ? "IN PRODUCTION" : move === "waiting_client" ? "WAITING ON CLIENT" : "HELD" }, ...section.items] }
      : section,
  );
}

function WorkRow({ item, selected, onSelect }: { item: CosTodaySectionItem; selected: boolean; onSelect: () => void }) {
  return (
    <li className="min-w-0 border-t border-[#2b2926] py-3 first:border-t-0" data-today-work-item={item.id}>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 break-words text-[14px] leading-relaxed text-[#e4dbd0]">{item.title}</p>
        <p className="shrink-0 text-[9px] uppercase tracking-[0.16em] text-[#8d8073]">{item.stateLabel}</p>
      </div>
      <p className="mt-1 break-words text-[13px] leading-relaxed text-[#9f9489]">{item.summary}</p>
      <button type="button" onClick={onSelect} className="mt-2 min-h-10 text-[9px] uppercase tracking-[0.16em] text-[#8d8073]">
        {selected ? "Selected for Sterling" : "Tell Sterling about this"}
      </button>
    </li>
  );
}

function IntakeCard({ intake, selected, onSelect }: { intake: ClientWebsiteIntake; selected: boolean; onSelect: () => void }) {
  const fields = websiteIntakeFields(intake);
  const whatMatters = websiteIntakeWhatMatters(intake);
  const submitted = websiteIntakeSubmittedLabel(intake.submittedAt);
  return (
    <details className="border-t border-[#2b2926] py-3 first:border-t-0" data-today-intake={intake.intakeId}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 outline-none marker:hidden">
        <span className="min-w-0 break-words text-[14px] text-[#e4dbd0]">Website inquiry — {intake.fullName}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">Open</span>
      </summary>
      <div className="min-w-0 pb-2 pt-2">
        {whatMatters ? (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#8d8073]">What matters</p>
            <p className="mt-1 break-words text-[14px] leading-relaxed text-[#d8cfc4]">{whatMatters}</p>
          </div>
        ) : null}
        <dl className="grid min-w-0 gap-x-5 gap-y-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="min-w-0">
              <dt className="text-[9px] uppercase tracking-[0.14em] text-[#6f675f]">{field.label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#c4b7aa]">{field.value}</dd>
            </div>
          ))}
          <div className="min-w-0">
            <dt className="text-[9px] uppercase tracking-[0.14em] text-[#6f675f]">Submitted</dt>
            <dd className="mt-0.5 break-words text-[13px] leading-relaxed text-[#c4b7aa]">{submitted}</dd>
          </div>
        </dl>
        <button type="button" onClick={onSelect} className="mt-3 min-h-10 text-[9px] uppercase tracking-[0.16em] text-[#8d8073]">
          {selected ? "Selected for Sterling" : "Tell Sterling about this"}
        </button>
      </div>
    </details>
  );
}

export function TodayOperatingSections({
  initialSections,
  intakes,
  businessTodayContext,
  askAction,
}: {
  initialSections: readonly CosTodaySectionView[];
  intakes: readonly ClientWebsiteIntake[];
  businessTodayContext: string;
  askAction?: SterlingAction;
}) {
  const [sections, setSections] = useState(() => initialSections.map((section) => ({ ...section, items: [...section.items] })));
  const [hiddenIntakes, setHiddenIntakes] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [failedQuery, setFailedQuery] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visibleIntakes = useMemo(() => intakes.filter((intake) => !hiddenIntakes.has(intake.intakeId)), [hiddenIntakes, intakes]);

  function submit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || !askAction) return;
    const before = sections;
    const beforeHidden = hiddenIntakes;
    const move = intendedMove(trimmed);
    const target = targetFor(trimmed, sections) ?? sections.flatMap((section) => section.items).find((item) => item.id === selectedTargetId) ?? null;
    const intakeTarget = intakes.find((intake) => trimmed.toLowerCase().includes(intake.fullName.split(/\s+/)[0]!.toLowerCase())) ?? intakes.find((intake) => intake.intakeId === selectedTargetId) ?? null;
    if (move && target) {
      setSections(
        applyOptimistic(sections, target, move).map((section) => ({
          ...section,
          items: [...section.items],
        })),
      );
    }
    if (move === "remove" && intakeTarget) setHiddenIntakes(new Set([...hiddenIntakes, intakeTarget.intakeId]));
    setReply(null);
    setFailedQuery(null);
    startTransition(async () => {
      try {
        const resolvedTarget = target
          ? { itemId: target.id, label: target.title, projectId: target.projectId, jobId: target.jobId }
          : intakeTarget
            ? { itemId: intakeTarget.intakeId, label: intakeTarget.fullName, projectId: null, jobId: intakeTarget.jobId }
            : undefined;
        const result = await askAction({ query: trimmed, mode: "conversation", businessTodayContext, todayTarget: resolvedTarget });
        if (!result || result.kind === "error" || (!result.writesCanonical && move)) throw new Error("mutation-not-confirmed");
        setReply(result.text ?? "Updated.");
        setQuery("");
        setSelectedTargetId(null);
      } catch {
        setSections(before.map((section) => ({ ...section, items: [...section.items] })));
        setHiddenIntakes(new Set(beforeHidden));
        setReply("I couldn't save that change.");
        setFailedQuery(trimmed);
      }
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(query);
  }

  return (
    <div className="mt-10 min-w-0" data-today-operating-sections="">
      {visibleIntakes.length > 0 ? (
        <details open className="border-b border-[#34312d] py-1" data-today-section="concierge-intake">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 outline-none marker:hidden">
            <span className="text-[11px] uppercase tracking-[0.22em] text-[#ad9164]">Concierge Intake / New Client</span>
            <span className="text-[10px] tabular-nums text-[#6f675f]">{visibleIntakes.length}</span>
          </summary>
          <div><ul>{visibleIntakes.map((intake) => <li key={intake.intakeId}><IntakeCard intake={intake} selected={selectedTargetId === intake.intakeId} onSelect={() => setSelectedTargetId(intake.intakeId)} /></li>)}</ul></div>
        </details>
      ) : null}
      {sections.map((section) => {
        const alwaysPresent = section.id === "founder" || section.id === "repairs";
        if (!alwaysPresent && section.items.length === 0) return null;
        return (
          <details
            key={section.id}
            open={section.id === "founder"}
            className="border-b border-[#34312d] py-1"
            data-today-section={section.id}
            data-cos-watching={section.items.some((item) => item.origin === "watching") ? "" : undefined}
          >
            {section.items.some((item) => item.origin === "watching") ? (
              <h2 className="sr-only">Chief of Staff briefing</h2>
            ) : null}
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 outline-none marker:hidden">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">{section.title}</span>
              <span className="text-[10px] tabular-nums text-[#6f675f]">{section.items.length}</span>
            </summary>
            <div>
              {section.items.length > 0 ? <ul>{section.items.map((item) => <WorkRow key={item.id} item={item} selected={selectedTargetId === item.id} onSelect={() => setSelectedTargetId(item.id)} />)}</ul> : <p className="pb-3 text-[13px] text-[#6f675f]">Nothing active.</p>}
            </div>
          </details>
        );
      })}
      <form onSubmit={onSubmit} className="sticky bottom-3 z-20 mt-8 min-w-0 rounded-sm border border-[#4a4136] bg-[#171614]/95 p-3 shadow-2xl backdrop-blur" data-tell-sterling="">
        <label htmlFor="tell-sterling" className="text-[10px] uppercase tracking-[0.18em] text-[#ad9164]">Tell Sterling…{selectedTargetId ? " · focused row" : ""}</label>
        <div className="mt-1 flex min-w-0 items-end gap-3">
          <textarea id="tell-sterling" value={query} onChange={(event) => setQuery(event.target.value)} rows={1} placeholder="What changed, or what should I do next?" className="max-h-32 min-h-11 min-w-0 flex-1 resize-y border-0 bg-transparent py-2 text-[15px] leading-relaxed text-[#efe8de] outline-none placeholder:text-[#6f675f]" />
          <button type="submit" disabled={pending || !query.trim() || !askAction} className="min-h-11 shrink-0 px-2 text-[10px] uppercase tracking-[0.18em] text-[#ad9164] disabled:opacity-40">{pending ? "Saving…" : "Send"}</button>
        </div>
        {reply ? <p role="status" className="mt-2 break-words text-[13px] leading-relaxed text-[#b8ada2]">{reply}</p> : null}
        {failedQuery ? <button type="button" onClick={() => submit(failedQuery)} className="mt-1 min-h-10 text-[10px] uppercase tracking-[0.16em] text-[#ad9164]">Retry</button> : null}
      </form>
    </div>
  );
}
