import {
  addCalendarDays,
  civilDateInZone,
  dateOnlyFromParts,
  FOUNDER_BUSINESS_TIME_ZONE,
} from "@/lib/continuum/date-only";
import {
  isOperationalSourceEvent,
  type SourceCommunicationEvent,
} from "@/lib/continuum/source-events/types";

export type WorkStage =
  | "queued"
  | "design_requested"
  | "cad_review"
  | "revision_requested"
  | "approved"
  | "order_confirmed"
  | "in_production"
  | "waiting_external"
  | "ready"
  | "complete";
export type ResponsibleActor = "founder" | "client" | "vendor_shop" | "unknown";
export type CurrentObligationKind =
  | "cad"
  | "confirmation"
  | "production"
  | "client_request"
  | "service"
  | "dependency"
  | "founder_action";
export type CurrentObligation = {
  id: string;
  identity: string;
  scope: string;
  kind: CurrentObligationKind;
  deliverable: string;
  revision: string | null;
  actor: ResponsibleActor;
  openedBy: string;
  closedBy: string | null;
  status: "active" | "satisfied" | "superseded";
};
export type NormalizedCommitment = {
  deliverable: string;
  actor: SourceCommunicationEvent["actor"];
  sourceTimestamp: string;
  originalWording: string;
  date: string | null;
  window: { start: string; end: string } | null;
  precision: "date" | "approximate" | "window" | "unresolved";
  assumptions: readonly string[];
  sourceRef: string;
};
export type CurrentWorkProjection = {
  workstreamId: string;
  stage: WorkStage;
  dependency: string | null;
  ballHolder: ResponsibleActor;
  activeObligations: CurrentObligation[];
  historicalObligations: CurrentObligation[];
  commitment: NormalizedCommitment | null;
  controllingSourceRefs: string[];
  asOf: string | null;
  provenance: {
    sourceRef: string;
    timestamp: string;
    wording: string;
    origin: string;
    applied: boolean;
    reason: string;
  }[];
};

export function sourceIdentity(e: SourceCommunicationEvent): string {
  const excerpt = (e.evidenceExcerpt || e.authorOwnedText)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return `${e.sourceType}:${e.messageId || e.sourceRef}:${e.semanticClass}:${excerpt}`;
}

function eventScope(e: SourceCommunicationEvent): string {
  if (e.cadIds.length) return `cad:${[...e.cadIds].sort().join(",")}`;
  if (e.orderIds.length) return `order:${[...e.orderIds].sort().join(",")}`;
  if (e.productionJobIds.length)
    return `production:${[...e.productionJobIds].sort().join(",")}`;
  if (e.threadId) return `thread:${e.threadId}`;
  return e.workLoopId ?? (e.projectId ? `project:${e.projectId}` : sourceIdentity(e));
}

function obligationKind(
  e: SourceCommunicationEvent,
  deliverable: string,
): CurrentObligationKind {
  if (e.semanticClass === "founder_correction") return "founder_action";
  if (e.semanticClass === "client_requests")
    return /\b(?:resize|repair|service)\b/i.test(deliverable)
      ? "service"
      : "client_request";
  if (/confirmation/i.test(deliverable)) return "confirmation";
  if (/production|manufacturing|bench/i.test(deliverable)) return "production";
  if (/CAD|STL|approval/i.test(deliverable)) return "cad";
  if (e.actor === "founder") return "founder_action";
  return "dependency";
}

function obligationIdentity(
  e: SourceCommunicationEvent,
  deliverable: string,
  revision: string | null,
): string {
  const kind = obligationKind(e, deliverable);
  if (kind === "client_request" || kind === "service")
    return `${sourceIdentity(e)}:${kind}`;
  return `${eventScope(e)}:${kind}:${revision ?? "current"}:${deliverable.toLowerCase()}`;
}

function sameScope(obligation: CurrentObligation, event: SourceCommunicationEvent): boolean {
  return obligation.scope === eventScope(event);
}
export function mergeCurrentSourceEvents(
  ...sets: (readonly SourceCommunicationEvent[] | undefined)[]
): SourceCommunicationEvent[] {
  const rows = sets
    .flatMap((s) => s ?? [])
    .sort(
      (a, b) =>
        sourceIdentity(a).localeCompare(sourceIdentity(b)) ||
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );
  return [...new Map(rows.map((e) => [sourceIdentity(e), e])).values()].sort(
    (a, b) => {
      const am = Date.parse(a.timestamp),
        bm = Date.parse(b.timestamp);
      return (
        (Number.isFinite(am) ? am : -Infinity) -
          (Number.isFinite(bm) ? bm : -Infinity) ||
        sourceIdentity(a).localeCompare(sourceIdentity(b))
      );
    },
  );
}
function businessDays(anchor: string, count: number): string {
  let day = anchor;
  for (let n = 0; n < count;) {
    day = addCalendarDays(day, 1)!;
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) n++;
  }
  return day;
}
export function normalizeCommitment(
  e: SourceCommunicationEvent,
  deliverable: string,
): NormalizedCommitment | null {
  const text = e.evidenceExcerpt || e.authorOwnedText;
  if (
    !/\b(?:tomorrow|business days?|delivery by|deliver by|have (?:it|them)|expected|due|promise|by \d|on \d)\b/i.test(
      text,
    )
  )
    return null;
  const anchor = Number.isFinite(Date.parse(e.timestamp))
    ? civilDateInZone(e.timestamp, FOUNDER_BUSINESS_TIME_ZONE)
    : null;
  const assumptions = [
    `Timezone: ${FOUNDER_BUSINESS_TIME_ZONE}`,
    "Business days: Monday–Friday; holidays not supplied",
  ];
  let date: string | null = null;
  let window: NormalizedCommitment["window"] = null;
  let precision: NormalizedCommitment["precision"] = "unresolved";
  const days = text.match(
    /(?:\b|[~≈]\s*)(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(?:\+\/-|±)?\s*business days?/i,
  );
  const explicitDates = [...text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)];
  const monthDayDates = [
    ...text.matchAll(/\b(?:by|on|delivery|or)\s+(\d{1,2})[\/](\d{1,2})(?:[\/](20\d{2}))?\b/gi),
  ];
  const ambiguousDates =
    explicitDates.length + monthDayDates.length > 1 ||
    /\b(?:date|timing)\s+(?:is\s+)?not confirmed\b/i.test(text);
  const explicit = explicitDates[0];
  const md = monthDayDates[0];
  if (ambiguousDates) {
    assumptions.push("Multiple or unconfirmed dates: no controlling date selected");
  } else if (explicit)
    date = dateOnlyFromParts(+explicit[1], +explicit[2], +explicit[3]);
  else if (md && (md[3] || anchor)) {
    date = dateOnlyFromParts(+(md[3] || anchor!.slice(0, 4)), +md[1], +md[2]);
    if (!md[3])
      assumptions.push(
        "Omitted year: source-message year; no automatic rollover",
      );
  } else if (anchor && /\btomorrow\b/i.test(text))
    date = addCalendarDays(anchor, 1);
  else if (anchor && days && +days[1] <= 366) {
    date = businessDays(anchor, +days[1]);
    if (days[2] && +days[2] >= +days[1] && +days[2] <= 366)
      window = { start: date, end: businessDays(anchor, +days[2]) };
  }
  if (date)
    precision = window
      ? "window"
      : /approximately|about|roughly|[~≈]|\+\/-|±|should/i.test(text)
        ? "approximate"
        : "date";
  return {
    deliverable,
    actor: e.actor,
    sourceTimestamp: e.timestamp,
    originalWording: text,
    date,
    window,
    precision,
    assumptions,
    sourceRef: e.sourceRef,
  };
}

function dependencyOf(text: string, fallback: string | null): string | null {
  if (/\bfinger size\b/i.test(text)) return "client reply / finger size";
  if (
    /\bwaiting (?:on|for)\b[^.!?]{0,35}\bpearl|\bpearl delivery\b/i.test(text)
  )
    return "pearl delivery";
  if (/\bwaiting (?:on|for)\b[^.!?]{0,35}\b(?:center )?stone\b/i.test(text))
    return "center stone";
  if (/\bfinal CAD\b/i.test(text)) return "final CAD";
  if (/\b(?:revised|updated) CAD\b/i.test(text)) return "revised CAD";
  if (
    /\bwaiting (?:on|for)\b[^.!?]{0,35}\b(?:client|reply|response)\b/i.test(
      text,
    )
  )
    return "client reply";
  const named = text.match(/\bwaiting (?:on|for)\s+([^.!?;]{3,70})/i);
  return named?.[1].trim() || fallback;
}

function founderCommitmentDependency(text: string): string | null {
  if (
    /\b(?:chain|video|options?|pric(?:e|ing)|availability)\b/i.test(text) &&
    /\bi(?:'ll| will) (?:send|get|show|check)\b/i.test(text)
  )
    return "Send chain video, options, and pricing.";
  const promise = text.match(
    /\bi(?:'ll| will)\s+((?:send|get|show|check|look(?:\s+into)?|follow up|call|email)\b[^.!?]{0,180})/i,
  );
  return promise ? `${promise[1].trim().replace(/\.$/, "")}.` : null;
}

/** Source-event branch of reduceWorkLoop. Association is established before reduction. */
export function projectCurrentWork(
  sourceEvents: readonly SourceCommunicationEvent[],
): CurrentWorkProjection | null {
  if (
    new Set(
      sourceEvents
        .filter(isOperationalSourceEvent)
        .map((e) => e.projectId)
        .filter(Boolean),
    ).size > 1
  )
    return null;
  const admitted = mergeCurrentSourceEvents(sourceEvents).filter(
    isOperationalSourceEvent,
  );
  if (!admitted.length) return null;
  const projects = new Set(admitted.map((e) => e.projectId).filter(Boolean));
  const keys = new Set(admitted.map((e) => e.workLoopId).filter(Boolean));
  if (projects.size > 1 || (projects.size === 0 && keys.size !== 1))
    return null;
  const workstreamId = projects.size
    ? `project:${[...projects][0]}`
    : [...keys][0]!;
  const result: CurrentWorkProjection = {
    workstreamId,
    stage: "queued",
    dependency: null,
    ballHolder: "unknown",
    activeObligations: [],
    historicalObligations: [],
    commitment: null,
    controllingSourceRefs: [],
    asOf: null,
    provenance: [],
  };
  const known = admitted.some((e) => Number.isFinite(Date.parse(e.timestamp)));
  if (!known && admitted.length > 1) {
    result.provenance = admitted.map((e) => ({
      sourceRef: e.sourceRef,
      timestamp: e.timestamp,
      wording: e.evidenceExcerpt,
      origin: e.provenance,
      applied: false,
      reason: "Multiple undated events: chronology unresolved; no supersession",
    }));
    return result;
  }
  let controlled = false;
  const close = (
    e: SourceCommunicationEvent,
    status: "satisfied" | "superseded",
    predicate: (o: CurrentObligation) => boolean = () => true,
  ) => {
    const kept: CurrentObligation[] = [];
    for (const o of result.activeObligations) {
      if (predicate(o))
        result.historicalObligations.push({
          ...o,
          status,
          closedBy: e.sourceRef,
        });
      else kept.push(o);
    }
    result.activeObligations = kept;
    if (
      result.commitment &&
      predicate({
        id: result.commitment.sourceRef,
        identity: obligationIdentity(
          e,
          result.commitment.deliverable,
          null,
        ),
        scope: eventScope(e),
        kind: obligationKind(e, result.commitment.deliverable),
        deliverable: result.commitment.deliverable,
        revision: null,
        actor: "unknown",
        openedBy: result.commitment.sourceRef,
        closedBy: null,
        status: "active",
      } as CurrentObligation)
    )
      result.commitment = null;
  };
  for (const e of admitted) {
    const text = e.evidenceExcerpt || e.authorOwnedText;
    const hasTime = Number.isFinite(Date.parse(e.timestamp));
    const record = {
      sourceRef: e.sourceRef,
      timestamp: e.timestamp,
      wording: text,
      origin: e.provenance,
      applied: false,
      reason: "",
    };
    result.provenance.push(record);
    if (!hasTime && (known || controlled)) {
      record.reason = "Unknown timestamp cannot establish newer truth";
      continue;
    }
    if (
      result.stage === "complete" &&
      e.semanticClass !== "founder_correction" &&
      !/\b(?:new (?:work|order|repair)|service|resize|repair)\b/i.test(text)
    ) {
      record.reason = "Terminal work requires explicit later service/new work";
      continue;
    }
    const revision =
      text.match(/\b(?:mod|revision|rev)\s*(\d+)\b/i)?.[1] ??
      e.attachmentFilenames.join(" ").match(/\bmod\s*(\d+)\b/i)?.[1] ??
      null;
    const cls = e.semanticClass;
    let stage = result.stage;
    let dependency: string | null = null;
    let actor: ResponsibleActor = "unknown";
    let delivered = false;
    const cad = (o: CurrentObligation) =>
      /CAD|STL|approval/i.test(o.deliverable) &&
      sameScope(o, e) &&
      (!revision || !o.revision || o.revision === revision);
    const explicitService = /\b(?:new (?:work|order|repair)|service|resize|repair)\b/i.test(text);
    if (result.stage === "complete" && explicitService) stage = "queued";
    if (cls === "work_complete") {
      stage = "complete";
      close(e, "satisfied");
    } else if (cls === "work_ready") {
      stage = "ready";
      close(e, "satisfied");
    } else if (cls === "founder_correction") {
      const correction = e.correction;
      if (!correction) continue;
      stage = correction.stage ?? stage;
      actor = correction.ballHolder;
      dependency = correction.dependency;
      close(e, "superseded");
    } else if (cls === "vendor_order_confirmation") {
      stage = "order_confirmed";
      close(e, "superseded", cad);
      if (/discrepanc|please (?:review|check|confirm|report)/i.test(text)) {
        actor = "founder";
        dependency = "confirmation discrepancy review";
      } else {
        actor = "founder";
        dependency = "order confirmation review";
      }
    } else if (cls === "workshop_started") {
      stage =
        /\b(?:production (?:has )?started|started production|in (?:production|manufacturing)|on the bench)\b/i.test(
          text,
        )
          ? "in_production"
          : "waiting_external";
      dependency = dependencyOf(
        text,
        stage === "in_production" ? "vendor production" : "final CAD",
      );
      actor = "vendor_shop";
      close(
        e,
        "superseded",
        (o) =>
          (sameScope(o, e) || o.kind === "founder_action") &&
          o.kind !== "client_request" &&
          o.kind !== "service" &&
          o.deliverable !== "confirmation discrepancy review",
      );
    } else if (cls === "client_approves") {
      stage = "approved";
      close(e, "satisfied", cad);
      actor = "founder";
      dependency = "place order";
    } else if (cls === "vendor_delivers_artifact") {
      const pending = result.activeObligations.filter((o) =>
        /CAD|STL/i.test(o.deliverable),
      );
      const scopedPending = pending.filter((o) => sameScope(o, e));
      if (e.cadIds.length && pending.length && !scopedPending.length) {
        record.reason = "Delivery identifiers conflict with the active deliverable";
        continue;
      }
      if (
        revision &&
        scopedPending.some((o) => o.revision && o.revision !== revision)
      ) {
        record.reason = "Delivery does not match active revision";
        continue;
      }
      // Pre-order files cannot reopen a completed approval/order cycle without a new request.
      if (
        ["approved", "order_confirmed", "in_production", "ready"].includes(
          stage,
        )
      ) {
        record.reason = "Historical artifact after approval/order";
        continue;
      }
      const filesAndText = `${text} ${e.attachmentFilenames.join(" ")}`;
      const receivedStl = /\bstl\b/i.test(filesAndText);
      const receivedCad = /\bcad\b|NL-H017-/i.test(filesAndText);
      if (
        scopedPending.some(
          (o) =>
            (o.revision && !revision) ||
            (o.deliverable === "STL" && !receivedStl) ||
            (/CAD/i.test(o.deliverable) && !receivedCad),
        )
      ) {
        record.reason =
          "Delivery does not identify the requested deliverable/revision";
        continue;
      }
      close(e, "satisfied", cad);
      delivered = true;
      stage = "cad_review";
      actor = "founder";
      dependency =
        receivedCad && receivedStl
          ? "CAD and STL review"
          : receivedStl
            ? "STL review"
            : "CAD review";
      const blocker = dependencyOf(text, null);
      if (blocker && !/CAD/i.test(blocker)) {
        dependency = blocker;
        actor = "unknown";
        stage = "waiting_external";
      }
    } else if (cls === "founder_requests_vendor") {
      stage = /revis|updated|change/i.test(text)
        ? "revision_requested"
        : "design_requested";
      dependency = dependencyOf(
        text,
        /STL/i.test(text)
          ? "STL"
          : stage === "revision_requested"
            ? "revised CAD"
            : "CAD",
      );
      actor = "vendor_shop";
      close(e, "superseded", cad);
    } else if (cls === "vendor_promises") {
      dependency = dependencyOf(text, result.dependency ?? "revised CAD");
      actor = "vendor_shop";
      if (!/CAD|STL/i.test(dependency ?? "")) stage = "waiting_external";
      else if (stage === "queued") stage = "revision_requested";
      close(
        e,
        "superseded",
        (o) =>
          sameScope(o, e) &&
          o.kind !== "client_request" &&
          o.kind !== "service" &&
          o.deliverable !== "confirmation discrepancy review",
      );
    } else if (cls === "founder_updates_client") {
      dependency = "client reply";
      actor = "client";
      close(e, "satisfied", (o) => sameScope(o, e) && o.kind === "cad");
    } else if (cls === "client_requests") {
      dependency = /shipping address|updated address|new address/i.test(text)
        ? "Ship them using the updated address and send confirmation."
        : dependencyOf(text, text.replace(/\s+/g, " ").trim().slice(0, 220));
      actor = "founder";
      close(
        e,
        "satisfied",
        (o) =>
          sameScope(o, e) &&
          o.actor === "client" &&
          o.identity === obligationIdentity(e, dependency!, revision),
      );
    } else if (cls === "founder_fulfills_commitment") {
      close(
        e,
        "satisfied",
        (o) =>
          /headed to you|\b(?:shipped|mailed)\b/i.test(text) ||
          (sameScope(o, e) && o.actor === "founder"),
      );
      dependency = founderCommitmentDependency(text);
      actor = dependency ? "founder" : actor;
    } else continue;
    // A changed blocker replaces only its own scoped stage obligation.
    if (dependency) {
      const identity = obligationIdentity(e, dependency, revision);
      close(
        e,
        delivered ? "satisfied" : "superseded",
        (o) =>
          cls !== "client_requests" &&
          sameScope(o, e) &&
          o.kind !== "client_request" &&
          o.kind !== "service" &&
          o.deliverable !== "confirmation discrepancy review" &&
          o.identity !== identity,
      );
      if (!result.activeObligations.some((o) => o.identity === identity))
        result.activeObligations.push({
          id: identity,
          identity,
          scope: eventScope(e),
          kind: obligationKind(e, dependency),
          deliverable: dependency,
          revision,
          actor,
          openedBy: e.sourceRef,
          closedBy: null,
          status: "active",
        });
    }
    result.stage = stage;
    const founder = [...result.activeObligations]
      .reverse()
      .find((o) => o.actor === "founder");
    result.dependency =
      founder?.deliverable ??
      dependency ??
      result.activeObligations[0]?.deliverable ??
      null;
    result.ballHolder = founder
      ? "founder"
      : dependency
        ? actor
        : (result.activeObligations[0]?.actor ?? "unknown");
    if (cls === "vendor_promises" || cls === "workshop_started")
      result.commitment = normalizeCommitment(e, dependency ?? "deliverable");
    result.controllingSourceRefs = [
      ...new Set([
        ...result.activeObligations.map((o) => o.openedBy),
        e.sourceRef,
      ]),
    ];
    result.asOf = hasTime ? e.timestamp : null;
    record.applied = true;
    record.reason = "Current operational evidence";
    controlled = true;
  }
  return controlled ? result : null;
}
