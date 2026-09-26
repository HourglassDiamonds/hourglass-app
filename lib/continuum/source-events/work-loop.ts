/**
 * Map source communication events into the work-loop chronology reducer.
 * Source events are the chronology backbone. Candidate remaining is supporting.
 */

import type { WorkLoopActor, WorkLoopDependency, WorkLoopEvent, WorkLoopEventType } from "@/lib/continuum/chief-of-staff/operating-loop/work-loop-state";
import type { SourceCommunicationEvent, SourceCommunicationEventClass } from "./types";

function parseMs(iso: string, fallback: number): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : fallback;
}

function mapping(semanticClass: SourceCommunicationEventClass): {
  eventType: WorkLoopEventType;
  opens: WorkLoopDependency | null;
  satisfies: WorkLoopDependency | null;
} {
  switch (semanticClass) {
    case "founder_requests_vendor":
      return { eventType: "founder_asks_vendor", opens: "vendor_shop", satisfies: "client" };
    case "founder_updates_client":
      return { eventType: "founder_asks_client", opens: "client", satisfies: "founder" };
    case "founder_fulfills_commitment":
      return { eventType: "founder_obligation", opens: null, satisfies: "founder" };
    case "client_requests":
      return { eventType: "client_turn", opens: "founder", satisfies: "client" };
    case "client_approves":
      return { eventType: "client_turn", opens: "founder", satisfies: "client" };
    case "client_replies_nonblocking":
    case "new_commercial_inquiry":
      return { eventType: "client_turn", opens: null, satisfies: "client" };
    case "vendor_promises":
      return { eventType: "vendor_promises_delivery", opens: "vendor_shop", satisfies: null };
    case "vendor_delivers_artifact":
      return { eventType: "vendor_delivers", opens: "founder", satisfies: "vendor_shop" };
    case "vendor_order_confirmation":
      return { eventType: "vendor_delivers", opens: "founder", satisfies: "vendor_shop" };
    case "vendor_acknowledges":
      return { eventType: "other", opens: null, satisfies: null };
    case "workshop_started":
      return { eventType: "vendor_promises_delivery", opens: "vendor_shop", satisfies: "founder" };
    default:
      return { eventType: "other", opens: null, satisfies: null };
  }
}

function actorOf(event: SourceCommunicationEvent): WorkLoopActor {
  if (event.actor === "vendor_shop") return "vendor_shop";
  if (event.actor === "founder") return "founder";
  if (event.actor === "client") return "client";
  return "system";
}

function summaryOf(event: SourceCommunicationEvent): string {
  const files = event.attachmentFilenames.join(" ");
  const mod = files.match(/Mod\s*(\d+)/i)?.[1] ?? event.authorOwnedText.match(/\bmod\s*(\d+)/i)?.[1];
  const hasStl = /\bstl\b|\.stl\b/i.test(`${event.authorOwnedText} ${files}`);
  const hasCad = /NL-H017-|\bcad\b/i.test(`${event.authorOwnedText} ${files}`);
  if (event.semanticClass === "vendor_delivers_artifact") {
    if (mod && hasStl) return `Mod ${mod} CAD and STL are in.`;
    if (mod) return `Mod ${mod} CAD is in.`;
    if (hasCad && hasStl) return "CAD and STL are in.";
    if (hasCad) return "CAD is in.";
    if (hasStl) return "STL is in.";
    return "Delivered CAD/STL is in.";
  }
  if (event.semanticClass === "vendor_order_confirmation") {
    const sp = event.orderIds[0] ?? event.authorOwnedText.match(/\bSP\d{4,}\b/i)?.[0];
    return sp
      ? `Order confirmation ${sp.toUpperCase()} is in.`
      : "Order confirmation is in.";
  }
  if (event.semanticClass === "workshop_started") {
    const rn = event.productionJobIds[0];
    return rn
      ? `${rn} is at workshop. Waiting on final CAD.`
      : "Stone is at workshop. Waiting on final CAD.";
  }
  if (event.semanticClass === "vendor_promises") {
    return "Updated CAD is pending from the shop.";
  }
  if (event.semanticClass === "vendor_acknowledges") {
    return "Shop acknowledged and is working the current instruction.";
  }
  const own = event.authorOwnedText.replace(/\s+/g, " ").trim();
  if (own && own !== (event.subject ?? "").trim()) return own.slice(0, 180);
  return (event.subject ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}

export function workLoopEventsFromSource(
  events: readonly SourceCommunicationEvent[],
  startIndex = 0,
): WorkLoopEvent[] {
  return events.map((event, index) => {
    const mapped = mapping(event.semanticClass);
    const text = summaryOf(event);
    return {
      timestamp: event.timestamp,
      sortMs: parseMs(event.timestamp, startIndex + index),
      actor: actorOf(event),
      eventType: mapped.eventType,
      opens: mapped.opens,
      satisfies: mapped.satisfies,
      text,
      sourceRef: event.sourceRef,
      threadId: event.threadId,
      fromSource: true,
    };
  });
}
