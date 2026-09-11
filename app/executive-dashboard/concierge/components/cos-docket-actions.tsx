import Link from "next/link";
import type { CosDocketItemView } from "@/lib/continuum/chief-of-staff/operating-loop/docket";
import {
  SNOOZE_PRESET_LABELS,
  SNOOZE_PRESETS,
  selectFounderControls,
  type CosFounderActionView,
} from "@/lib/continuum/chief-of-staff/operating-loop/founder-actions";

type DisposeAction = (formData: FormData) => void | Promise<void>;

function HiddenFields({
  item,
  verb,
}: {
  item: CosDocketItemView;
  verb: string;
}) {
  const controls = selectFounderControls(item);
  const candidateIds = [
    ...(item.brief?.candidateIds ?? []),
    ...(item.decision?.candidateIds ?? []),
    ...(controls.specConflict?.candidateId ? [controls.specConflict.candidateId] : []),
  ];
  return (
    <>
      <input type="hidden" name="verb" value={verb} />
      <input type="hidden" name="origin" value={item.origin} />
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="projectId" value={item.job?.projectId ?? item.brief?.projectId ?? item.decision?.projectId ?? item.anomaly?.projectId ?? ""} />
      <input type="hidden" name="jobId" value={item.job?.id ?? item.decision?.recap?.jobId ?? ""} />
      <input type="hidden" name="candidateIds" value={[...new Set(candidateIds)].join(",")} />
      <input type="hidden" name="specFieldName" value={controls.specConflict?.fieldName ?? ""} />
      <input type="hidden" name="specProposedValue" value={controls.specConflict?.proposedValue ?? ""} />
      <input type="hidden" name="specCanonicalValue" value={controls.specConflict?.canonicalValue ?? ""} />
      <input type="hidden" name="mutationId" value={item.job?.mutationId ?? item.decision?.recap?.mutationId ?? ""} />
    </>
  );
}

function ActionButton({
  action,
  item,
  disposeAction,
  className,
}: {
  action: CosFounderActionView;
  item: CosDocketItemView;
  disposeAction?: DisposeAction;
  className: string;
}) {
  if (action.needsSnooze) {
    return (
      <details className="hg-cos-snooze inline min-w-0 align-middle" data-cos-snooze={action.verb}>
        <summary className={className}>{action.label}</summary>
        <div className="mt-2 flex min-w-0 flex-wrap gap-x-5">
          {SNOOZE_PRESETS.filter((preset) => preset !== "choose_date").map((preset) => (
            <form action={disposeAction} key={preset}>
              <HiddenFields item={item} verb={action.verb} />
              <input type="hidden" name="snoozePreset" value={preset} />
              <button type="submit" className={className}>
                {SNOOZE_PRESET_LABELS[preset]}
              </button>
            </form>
          ))}
          <form action={disposeAction} className="flex min-w-0 flex-wrap items-center gap-x-3">
            <HiddenFields item={item} verb={action.verb} />
            <input type="hidden" name="snoozePreset" value="choose_date" />
            <label className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#8d8073]">
              Choose date
              <input
                type="date"
                name="snoozeDate"
                required
                className="ml-3 bg-transparent text-[#efe8de] outline-none"
              />
            </label>
            <button type="submit" className={className}>
              Save
            </button>
          </form>
        </div>
      </details>
    );
  }
  return (
    <form action={disposeAction} className="inline">
      <HiddenFields item={item} verb={action.verb} />
      <button type="submit" className={className} data-cos-founder-verb={action.verb}>
        {action.label}
      </button>
    </form>
  );
}

function buttonClass(emphasis: "primary" | "secondary"): string {
  const color = emphasis === "primary" ? "text-[#efe8de]" : "text-[#ad9164]";
  return `inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] ${color} outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]`;
}

export function CosDocketActions({
  item,
  disposeAction,
}: {
  item: CosDocketItemView;
  disposeAction?: DisposeAction;
}) {
  const controls = selectFounderControls(item);
  const visibleFallback = controls.fallback.filter((action) => {
    if (action.verb === "complete" && controls.completableJob) return false;
    return true;
  });
  const evidence = controls.evidence;
  return (
    <div className="hg-cos-founder-actions mt-2 min-w-0">
      {controls.actions.length > 0 || visibleFallback.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-5" data-cos-founder-family={controls.family}>
          {controls.confirmPerson ? (
            <Link
              href={controls.confirmPerson.href}
              className={buttonClass("primary")}
              data-cos-founder-verb="confirm_person"
            >
              Confirm person
            </Link>
          ) : null}
          {controls.actions.map((action) => (
            <ActionButton
              key={action.verb}
              action={action}
              item={item}
              disposeAction={disposeAction}
              className={buttonClass(action.emphasis)}
            />
          ))}
          {visibleFallback.map((action) => (
            <ActionButton
              key={action.verb}
              action={action}
              item={item}
              disposeAction={disposeAction}
              className={buttonClass(action.emphasis)}
            />
          ))}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-x-5">
        {controls.openProjectHref ? (
          <Link
            href={controls.openProjectHref}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Open project
          </Link>
        ) : null}
        {controls.openEmail ? (
          <Link
            href={controls.openEmail.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Open email
          </Link>
        ) : controls.emailSources.length > 1 ? (
          <details className="hg-cos-email-sources inline min-w-0 align-middle">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]">
              Open email
            </summary>
            <span className="mt-1 flex min-w-0 flex-col">
              {controls.emailSources.map((source) => (
                <Link
                  key={source.href}
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de]"
                >
                  {source.label}
                </Link>
              ))}
            </span>
          </details>
        ) : null}
        {item.job ? (
          <Link
            href={item.job.editHref}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#ad9164] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
          >
            Edit
          </Link>
        ) : null}
        {evidence ? (
          <details className="hg-cos-evidence inline min-w-0 align-middle">
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-[10px] uppercase tracking-[0.16em] text-[#5c564f] outline-none hover:text-[#6f675f] focus-visible:text-[#6f675f]">
              Evidence
            </summary>
            <div className="mt-2 min-w-0" data-cos-founder-evidence="">
              <p className="break-words text-[13px] leading-relaxed text-[#c4b7aa]">
                {evidence.why}
              </p>
              {evidence.facts.map((fact) => (
                <p key={fact.label} className="break-words text-[13px] leading-relaxed text-[#9a8e82]">
                  {fact.label}: {fact.value}
                </p>
              ))}
              {evidence.source ? (
                <p className="break-words text-[13px] leading-relaxed text-[#9a8e82]">
                  {evidence.source}
                </p>
              ) : null}
              {evidence.beats.length > 0 ? (
                <ol className="mt-2 space-y-2">
                  {evidence.beats.map((beat) => (
                    <li key={beat.candidateId} className="min-w-0">
                      <p className="break-words text-[13px] leading-relaxed text-[#c4b7aa]">
                        {beat.sourceHref ? (
                          <Link
                            href={beat.sourceHref}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#ad9164] outline-none hover:text-[#efe8de]"
                          >
                            {beat.label}
                          </Link>
                        ) : (
                          beat.label
                        )}
                      </p>
                      <p className="break-words text-[13px] leading-relaxed text-[#9a8e82]">
                        {beat.summary}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
