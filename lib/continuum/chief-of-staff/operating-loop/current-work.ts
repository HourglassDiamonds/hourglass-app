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
import {
  isPostCompletionObligationText,
  isProductionExceptionText,
  todayLifecycleClass,
} from "@/lib/continuum/candidates/today-lifecycle";

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

/** Durable lifecycle closes earlier source-derived dependencies, while a later
 * founder correction remains authoritative over both. */
export function reconcileProjectionWithLifecycle(input: {
  projection: CurrentWorkProjection;
  lifecycle: string | null | undefined;
  projectId: string | null | undefined;
}): CurrentWorkProjection {
  const { projection } = input;
  const lifecycleClass = todayLifecycleClass(input.lifecycle);
  if (!["production", "ready", "terminal"].includes(lifecycleClass)) return projection;
  const latestApplied = [...projection.provenance].reverse().find((row) => row.applied);
  if (latestApplied?.origin === "founder_correction") return projection;
  const latestWording = latestApplied?.wording ?? "";
  if (lifecycleClass === "terminal" && isPostCompletionObligationText(latestWording)) {
    return projection;
  }
  if (lifecycleClass === "production" && isProductionExceptionText(latestWording)) {
    return projection;
  }

  const targetStage: WorkStage = lifecycleClass === "production"
    ? "in_production"
    : lifecycleClass === "ready" ? "ready" : "complete";
  const rank: Record<WorkStage, number> = {
    queued: 0, design_requested: 1, revision_requested: 2, cad_review: 3,
    approved: 4, order_confirmed: 5, waiting_external: 5,
    in_production: 6, ready: 7, complete: 8,
  };
  const staleFounderStageWork =
    lifecycleClass === "production" &&
    projection.activeObligations.some(
      (obligation) =>
        obligation.actor === "founder" &&
        (obligation.kind === "cad" || obligation.kind === "confirmation"),
    );
  if (rank[projection.stage] >= rank[targetStage] && !staleFounderStageWork) {
    return projection;
  }

  const sourceRef = input.projectId
    ? `canonical-project-lifecycle:${input.projectId}`
    : "canonical-project-lifecycle";
  const dependency = lifecycleClass === "production"
    ? "production completion"
    : lifecycleClass === "ready" ? "delivery or pickup" : null;
  const activeObligations: CurrentObligation[] = dependency ? [{
    id: `${sourceRef}:${targetStage}`,
    identity: `${sourceRef}:${targetStage}`,
    scope: input.projectId ? `project:${input.projectId}` : sourceRef,
    kind: lifecycleClass === "production" ? "production" : "dependency",
    deliverable: dependency,
    revision: null,
    actor: lifecycleClass === "production" ? "vendor_shop" : "unknown",
    openedBy: sourceRef,
    closedBy: null,
    status: "active",
  }] : [];
  return {
    ...projection,
    stage: targetStage,
    dependency,
    ballHolder: lifecycleClass === "production" ? "vendor_shop" : "unknown",
    activeObligations,
    historicalObligations: [
      ...projection.historicalObligations,
      ...projection.activeObligations.map((obligation) => ({
        ...obligation,
        status: "superseded" as const,
        closedBy: sourceRef,
      })),
    ],
    commitment:
      lifecycleClass === "production" && projection.commitment?.actor !== "founder"
        ? projection.commitment
        : null,
    controllingSourceRefs: dependency ? [sourceRef] : [],
    provenance: [...projection.provenance, {
      sourceRef,
      timestamp: projection.asOf ?? "",
      wording: input.lifecycle?.trim() || lifecycleClass,
      origin: "canonical_project_lifecycle",
      applied: true,
      reason: "Durable lifecycle advances and supersedes earlier-stage dependencies",
    }],
  };
}

export function sourceIdentity(e: SourceCommunicationEvent): string {
  const excerpt = collapseRepeatedWording(e.evidenceExcerpt || e.authorOwnedText)
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

function cadScope(scope: string): Set<string> | null {
  if (!scope.startsWith("cad:")) return null;
  return new Set(
    scope
      .slice(4)
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  );
}

function scopesOverlap(left: string, right: string): boolean {
  if (left === right) return true;
  const leftCads = cadScope(left);
  const rightCads = cadScope(right);
  if (!leftCads || !rightCads) return false;
  return [...leftCads].some((cad) => rightCads.has(cad));
}

function sameScope(obligation: CurrentObligation, event: SourceCommunicationEvent): boolean {
  return scopesOverlap(obligation.scope, eventScope(event));
}

function eventsShareScope(
  authority: SourceCommunicationEvent,
  event: SourceCommunicationEvent,
): boolean {
  if (authority.projectId && authority.projectId === event.projectId) return true;
  if (authority.workLoopId && authority.workLoopId === event.workLoopId) return true;
  if (authority.threadId && authority.threadId === event.threadId) return true;
  return scopesOverlap(eventScope(authority), eventScope(event));
}

type FounderDirectiveTransition = "blocked" | "reinforce" | "advance";

function transitionAfterFounderDirective(
  authority: SourceCommunicationEvent,
  event: SourceCommunicationEvent,
  text: string,
): FounderDirectiveTransition {
  const authorityMs = Date.parse(authority.timestamp);
  const eventMs = Date.parse(event.timestamp);
  if (
    !Number.isFinite(authorityMs) ||
    !Number.isFinite(eventMs) ||
    eventMs <= authorityMs ||
    !eventsShareScope(authority, event)
  ) {
    return "blocked";
  }
  const correction = authority.correction;
  if (!correction) return "blocked";
  const explicitlyHeld =
    correction.ballHolder === "unknown" &&
    /\bheld?\b|\bhold\b/i.test(correction.dependency ?? authority.evidenceExcerpt);
  if (explicitlyHeld) return "blocked";
  const explicitNewWork =
    /\b(?:new (?:work|order|repair|project|piece)|service|resize|repair|rework)\b/i.test(
      text,
    );
  if (correction.stage === "complete") {
    return explicitNewWork ? "advance" : "blocked";
  }
  if (event.semanticClass === "work_complete" || event.semanticClass === "work_ready") {
    return "advance";
  }
  if (explicitNewWork) return "advance";
  if (correction.stage === "in_production") {
    if (event.semanticClass === "material_arrives") return "advance";
    if (event.semanticClass === "workshop_started") return "reinforce";
    if (
      event.semanticClass === "vendor_order_confirmation" &&
      !/\b(?:discrepanc|please (?:review|check|confirm|report)|report .{0,40}asap)\b/i.test(
        text,
      )
    ) {
      return "reinforce";
    }
    return "blocked";
  }
  if (
    event.semanticClass === "workshop_started" ||
    event.semanticClass === "material_arrives" ||
    event.semanticClass === "vendor_order_confirmation"
  ) {
    return "advance";
  }
  if (
    correction.ballHolder === "vendor_shop" &&
    (event.semanticClass === "vendor_delivers_artifact" ||
      event.semanticClass === "vendor_promises")
  ) {
    return "advance";
  }
  if (
    correction.ballHolder === "client" &&
    (event.semanticClass === "client_requests" ||
      event.semanticClass === "client_approves" ||
      event.semanticClass === "client_promises" ||
      event.semanticClass === "client_replies_nonblocking")
  ) {
    return "advance";
  }
  return "blocked";
}

function obligationTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(
        (token) =>
          token.length >= 3 &&
          !["the", "and", "for", "with", "over", "here", "shortly", "tomorrow"].includes(token),
      ),
  );
}

function substantiallySameDeliverable(left: string, right: string): boolean {
  const a = obligationTokens(left);
  const b = obligationTokens(right);
  if (a.size === 0 || b.size === 0) {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }
  const overlap = [...a].filter((token) => b.has(token)).length;
  return overlap / Math.min(a.size, b.size) >= 0.75;
}

function materialClosureEvent(event: SourceCommunicationEvent | undefined): boolean {
  if (!event) return false;
  if (
    [
      "client_replies_nonblocking",
      "material_arrives",
      "workshop_started",
      "vendor_order_confirmation",
      "work_ready",
      "work_complete",
    ].includes(event.semanticClass)
  ) {
    return true;
  }
  return event.semanticClass === "founder_fulfills_commitment" && event.hasAttachments;
}

function materiallyClosedFounderCommitment(
  projection: CurrentWorkProjection,
  deliverable: string,
  sourceRef: string,
  sourceEvents: readonly SourceCommunicationEvent[],
): boolean {
  const byRef = new Map(sourceEvents.map((event) => [event.sourceRef, event]));
  return projection.historicalObligations.some(
    (obligation) =>
      obligation.actor === "founder" &&
      obligation.openedBy !== sourceRef &&
      obligation.closedBy !== null &&
      materialClosureEvent(byRef.get(obligation.closedBy)) &&
      (obligation.status === "satisfied" || obligation.status === "superseded") &&
      substantiallySameDeliverable(obligation.deliverable, deliverable),
  );
}

function isFounderReceiptAcknowledgement(event: SourceCommunicationEvent): boolean {
  if (event.actor !== "founder" || event.semanticClass !== "unknown_communication") return false;
  const own = collapseRepeatedWording(event.evidenceExcerpt || event.authorOwnedText)
    .replace(/\s+/g, " ")
    .trim();
  return /^(?:thank you|thanks|got it|received|perfect|sounds good)\b[^?]{0,120}$/i.test(own) &&
    /\b(?:received|got it)\b/i.test(own);
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

function collapseRepeatedWording(value: string): string {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  for (let width = 3; width <= Math.floor(words.length / 2); width += 1) {
    if (words.length % width !== 0) continue;
    const first = words.slice(0, width).join(" ").replace(/[.!?]+$/, "").toLowerCase();
    const repeats = words.length / width;
    if (
      repeats > 1 &&
      Array.from({ length: repeats }, (_, index) =>
        words.slice(index * width, (index + 1) * width).join(" ").replace(/[.!?]+$/, "").toLowerCase(),
      ).every((part) => part === first)
    ) {
      return words.slice(0, width).join(" ");
    }
  }
  return words.join(" ");
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

function externalPromiseDependency(text: string): string | null {
  const promise = text.match(
    /\bi(?:['’]ll| will| am going to)\s+((?:send|get|show|check|look(?:\s+into)?|follow up|call|email|let you know)\b[^.!?]{0,180})/i,
  );
  return promise ? promise[1].trim().replace(/\.$/, "") : null;
}

/** Source-event branch of reduceWorkLoop. Association is established before reduction. */
export function projectCurrentWork(
  sourceEvents: readonly SourceCommunicationEvent[],
): CurrentWorkProjection | null {
  const chronological = mergeCurrentSourceEvents(sourceEvents);
  const sourceThread = (sourceRef: string) => sourceRef.split("|")[1] ?? sourceRef;
  const withVendorFollowups = chronological.map((event, index) => {
    if (
      event.semanticClass !== "unknown_communication" ||
      event.actor !== "founder" ||
      !/\bHGD\s*x\s+.+-C\d{5,}/i.test(event.subject ?? "") ||
      /\b(?:i(?:'ll| will)|let me|report back|i can find|i can get|i can send)\b/i.test(
        event.evidenceExcerpt || event.authorOwnedText,
      )
    ) {
      return event;
    }
    const eventMs = Date.parse(event.timestamp);
    const cads = new Set(event.cadIds.map((cad) => cad.toUpperCase()));
    const priorRows = chronological.slice(0, index);
    const vendorBlockingRequest = priorRows.some((prior) => {
      const priorMs = Date.parse(prior.timestamp);
      const wording = prior.evidenceExcerpt || prior.authorOwnedText;
      return ["vendor_shop", "unknown"].includes(prior.actor) &&
        prior.direction === "inbound" &&
        Number.isFinite(eventMs) &&
        Number.isFinite(priorMs) &&
        priorMs < eventMs &&
        /\b(?:can you|could you|please|need you to)\b|\?/i.test(wording) &&
        (prior.workLoopId === event.workLoopId || prior.cadIds.some((cad) => cads.has(cad.toUpperCase())));
    });
    const answeredClientRequest = chronological.slice(0, index).some((prior) => {
      const priorMs = Date.parse(prior.timestamp);
      return prior.semanticClass === "client_requests" &&
        sourceThread(prior.sourceRef) !== sourceThread(event.sourceRef) &&
        Number.isFinite(eventMs) &&
        Number.isFinite(priorMs) &&
        priorMs < eventMs &&
        (prior.workLoopId === event.workLoopId || prior.cadIds.some((cad) => cads.has(cad.toUpperCase())));
    });
    return answeredClientRequest && !vendorBlockingRequest
      ? { ...event, semanticClass: "founder_requests_vendor" as const }
      : event;
  });
  const authoritativeCorrections = withVendorFollowups.filter(
    (event) =>
      event.semanticClass === "founder_correction" &&
      event.provenance === "founder_correction" &&
      event.correction,
  );
  if (
    new Set(
      withVendorFollowups
        .filter(isOperationalSourceEvent)
        .map((e) => e.projectId)
        .filter(Boolean),
    ).size > 1 &&
    authoritativeCorrections.length === 0
  )
    return null;
  const admitted = withVendorFollowups.filter(
    (event) =>
      isOperationalSourceEvent(event) ||
      (event.workIdentityBasis !== null &&
        (event.semanticClass === "client_replies_nonblocking" ||
          isFounderReceiptAcknowledgement(event))),
  );
  if (!admitted.length) return null;
  const projects = new Set(admitted.map((e) => e.projectId).filter(Boolean));
  const keys = new Set(admitted.map((e) => e.workLoopId).filter(Boolean));
  const latestFounderCorrection = authoritativeCorrections.at(-1) ?? null;
  if (
    (projects.size > 1 && !latestFounderCorrection) ||
    (projects.size === 0 && keys.size !== 1 && !latestFounderCorrection)
  )
    return null;
  const workstreamId =
    latestFounderCorrection?.workLoopId ??
    (latestFounderCorrection?.projectId
      ? `project:${latestFounderCorrection.projectId}`
      : null) ??
    (projects.size === 1 ? `project:${[...projects][0]}` : [...keys].sort()[0]!);
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
  let founderAuthority: SourceCommunicationEvent | null = null;
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
    const text = collapseRepeatedWording(e.evidenceExcerpt || e.authorOwnedText);
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
    if (founderAuthority && e.semanticClass !== "founder_correction") {
      const transition = transitionAfterFounderDirective(founderAuthority, e, text);
      if (transition === "blocked") {
        record.reason = "Founder directive outranks lower-authority evidence";
        continue;
      }
      if (transition === "advance") founderAuthority = null;
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
    } else if (cls === "material_arrives") {
      stage = "waiting_external";
      close(e, "superseded");
      dependency = null;
      actor = "unknown";
    } else if (cls === "founder_correction") {
      const correction = e.correction;
      if (!correction) continue;
      stage = correction.stage ?? stage;
      actor = correction.ballHolder;
      dependency = correction.dependency;
      close(e, "superseded");
      founderAuthority = e;
    } else if (cls === "vendor_order_confirmation") {
      close(e, "superseded", cad);
      if (/discrepanc|please (?:review|check|confirm|report)/i.test(text)) {
        stage = "order_confirmed";
        actor = "founder";
        dependency = "confirmation discrepancy review";
      } else {
        stage = "in_production";
        actor = "vendor_shop";
        dependency = "production completion";
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
      const fallback = /STL/i.test(text)
        ? "STL"
        : stage === "revision_requested"
          ? "revised CAD"
          : "CAD";
      dependency = /\b(?:can you|could you|please|checking|follow(?:ing)? up|send|revise|update|change|render)\b/i.test(text)
        ? dependencyOf(text, fallback)
        : fallback;
      actor = "vendor_shop";
      close(
        e,
        "superseded",
        (obligation) => sameScope(obligation, e) && obligation.kind !== "service",
      );
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
    } else if (cls === "client_promises") {
      stage = "waiting_external";
      dependency = externalPromiseDependency(text) ?? "client response";
      actor = "client";
      close(
        e,
        "superseded",
        (o) => sameScope(o, e) && o.actor === "founder",
      );
    } else if (cls === "client_replies_nonblocking") {
      const supersededFounderWork = result.activeObligations.some(
        (o) => sameScope(o, e) && o.actor === "founder",
      );
      if (!supersededFounderWork) {
        record.reason = "Nonblocking reply does not create work";
        continue;
      }
      close(
        e,
        "satisfied",
        (o) => sameScope(o, e) && o.actor === "founder",
      );
      dependency = null;
      actor = "unknown";
    } else if (isFounderReceiptAcknowledgement(e)) {
      const received = result.activeObligations.find(
        (o) =>
          sameScope(o, e) &&
          o.actor === "vendor_shop" &&
          /CAD|STL/i.test(o.deliverable),
      );
      if (!received) {
        record.reason = "Receipt acknowledgement has no active CAD/STL delivery to satisfy";
        continue;
      }
      close(
        e,
        "satisfied",
        (o) => sameScope(o, e) && o.actor === "vendor_shop" && /CAD|STL/i.test(o.deliverable),
      );
      stage = "cad_review";
      dependency = /STL/i.test(received.deliverable) ? "STL review" : "CAD review";
      actor = "founder";
    } else if (cls === "founder_fulfills_commitment") {
      close(
        e,
        "satisfied",
        (o) =>
          /headed to you|\b(?:shipped|mailed)\b/i.test(text) ||
          (sameScope(o, e) &&
            (o.actor === "founder" || (e.hasAttachments && o.kind === "cad"))),
      );
      // An attachment-bearing fulfillment can carry quoted promise text;
      // that text cannot reopen the same obligation it just satisfied.
      // Text-only messages may still establish a genuine new commitment.
      dependency = e.hasAttachments ? null : founderCommitmentDependency(text);
      if (
        dependency &&
        materiallyClosedFounderCommitment(result, dependency, e.sourceRef, admitted) &&
        !/\b(?:again|still need|new request|new commitment|actually|reopen)\b/i.test(text)
      ) {
        dependency = null;
        record.reason = "Materially closed founder commitment cannot reopen without explicit new intent";
      }
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
    if (cls === "vendor_promises" || cls === "workshop_started" || cls === "client_promises")
      result.commitment = normalizeCommitment(e, dependency ?? "deliverable");
    result.controllingSourceRefs = [
      ...new Set([
        ...result.activeObligations.map((o) => o.openedBy),
        e.sourceRef,
      ]),
    ];
    result.asOf = hasTime ? e.timestamp : null;
    record.applied = true;
    if (!record.reason) record.reason = "Current operational evidence";
    controlled = true;
  }
  return controlled ? result : null;
}
