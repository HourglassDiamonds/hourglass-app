import type { ReasoningBrain } from "../concierge-sol/types";
import type { ConciergeSolWorld } from "../concierge-sol/world";
import {
  CAPTURE_CONTRACT_VERSION,
  type CaptureEntityReference,
  type CaptureEntityResolution,
  type CaptureProposal,
  type CaptureProposedItem,
  type CaptureRequest,
} from "./types";
import { isCaptureProposal, isCaptureRequest } from "./validate";

export type CaptureInterpretationDeps = {
  brain: ReasoningBrain;
  world: Pick<ConciergeSolWorld, "searchPeople" | "listProjects">;
};

export async function interpretCapture(
  deps: CaptureInterpretationDeps,
  request: CaptureRequest,
): Promise<CaptureProposal> {
  if (!isCaptureRequest(request)) return fallbackProposal(request, "The capture request was invalid.");
  try {
    const response = await deps.brain.complete({
      mode: "conversation",
      system: interpretationPrompt(request),
      messages: [{ role: "user", content: request.text }],
      tools: [],
    });
    if (response.turn.kind !== "message") return fallbackProposal(request, "Interpretation needs review.");
    const parsed = parseJson(response.turn.text);
    if (!isCaptureProposal(parsed) || parsed.captureId !== request.captureId) {
      return fallbackProposal(request, "Interpretation needs review.");
    }
    const resolved = await resolveProposal(deps.world, parsed, request.context);
    return isCaptureProposal(resolved)
      ? resolved
      : fallbackProposal(request, "Resolved entities need review.");
  } catch {
    return fallbackProposal(request, "Interpretation is temporarily unavailable. Retry your original capture.");
  }
}

function interpretationPrompt(request: CaptureRequest): string {
  return [
    "Convert the founder input into one or more independent capture proposals.",
    "Return JSON only, matching the CaptureProposal contract.",
    'Shape: {version:1,captureId:string,canonical:false,items:[{itemId:string,kind:"action"|"reminder"|"watching"|"note",sourceExcerpt:string,title:string,content:string,confidence:number,entityResolution?:{status:"unresolved",mention:string},timing?:Timing,clarification?:{question:string}}]}.',
    'Timing is {kind:"date-only",originalWording:string,date:"YYYY-MM-DD"} or {kind:"exact-instant",originalWording:string,instantAt:ISO timestamp with offset,timezone:IANA timezone} or {kind:"checkpoint",originalWording:string,condition:string,checkAt?:date-only or exact-instant timing} or {kind:"unspecified",originalWording:string}.',
    "Use unique itemIds containing only letters, digits, underscores or hyphens (maximum 128 characters), titles at most 160 characters, nonempty sourceExcerpt/content, confidence from 0 to 1. Omit absent optional fields; do not use null or extra keys. At most 100 items.",
    `Set version=${CAPTURE_CONTRACT_VERSION}, captureId=${request.captureId}, canonical=false.`,
    "Kinds: action, reminder, watching, note. Split distinct asks into distinct items.",
    "Never claim an identity match. Put named entities in entityResolution as unresolved.",
    "For both kinds use mention 'person: NAME | project: PROJECT'.",
    "Use date-only only for dates without a time; exact-instant for a stated time; checkpoint for conditional watching.",
    "Never convert an exact time into a date-only value.",
    `Reference time: ${request.referenceTime}. Timezone: ${request.timezone}.`,
  ].join("\n");
}

function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(trimmed); } catch { return null; }
}

export function fallbackProposal(
  request: Pick<CaptureRequest, "captureId" | "text">,
  question = "Review this capture before saving.",
): CaptureProposal {
  const content = request.text.replace(/\s+/g, " ").trim() || "Empty capture";
  return {
    version: CAPTURE_CONTRACT_VERSION,
    captureId: safeId(request.captureId, "capture"),
    canonical: false,
    items: [{
      itemId: `${safeId(request.captureId, "capture")}_fallback`,
      kind: "note",
      sourceExcerpt: content,
      title: content.slice(0, 160),
      content,
      clarification: { question },
      confidence: 0,
    }],
  };
}

function safeId(value: string, fallback: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) && value.length <= 128 ? value : fallback;
}

export async function resolveProposal(
  world: Pick<ConciergeSolWorld, "searchPeople" | "listProjects">,
  proposal: CaptureProposal,
  context?: CaptureRequest["context"],
): Promise<CaptureProposal> {
  const items = await Promise.all(proposal.items.map(async (item) => {
    const entityResolution = await resolveItem(world, item, context);
    return entityResolution ? { ...item, entityResolution } : item;
  }));
  return { ...proposal, items };
}

async function resolveItem(
  world: Pick<ConciergeSolWorld, "searchPeople" | "listProjects">,
  item: CaptureProposedItem,
  context?: CaptureRequest["context"],
): Promise<CaptureEntityResolution | undefined> {
  if (context?.personId || context?.projectId) {
    return { status: "resolved", ...context, evidence: "Existing capture context supplied by Continuum." };
  }
  if (item.entityResolution?.status !== "unresolved") return item.entityResolution;
  const mention = item.entityResolution.mention;
  const personMention = part(mention, "person");
  const projectMention = part(mention, "project");
  const people = personMention ? await world.searchPeople(personMention) : [];
  const projects = projectMention ? await world.listProjects() : [];
  const personMatches = people.filter((row) => same(row.displayName, personMention!));
  const projectMatches = projects.filter((row) => same(row.title, projectMention!));
  const candidates: CaptureEntityReference[] = [
    ...personMatches.map((row) => ({ kind: "person" as const, id: row.personId, evidence: `Existing Person named ${row.displayName}.` })),
    ...projectMatches.map((row) => ({ kind: "project" as const, id: row.projectId, evidence: `Existing Project titled ${row.title}.` })),
  ];
  const personId = personMatches.length === 1 ? personMatches[0].personId : undefined;
  const projectId = projectMatches.length === 1 ? projectMatches[0].projectId : undefined;
  const hasAmbiguity = personMatches.length > 1 || projectMatches.length > 1;
  const missing = (!!personMention && !personId) || (!!projectMention && !projectId);
  if (hasAmbiguity || (missing && candidates.length)) return { status: "ambiguous", candidates };
  if (!missing && (personId || projectId)) {
    return { status: "resolved", ...(personId ? { personId } : {}), ...(projectId ? { projectId } : {}), evidence: candidates.map((row) => row.evidence).join(" ") };
  }
  return { status: "unresolved", mention };
}

function part(mention: string, kind: "person" | "project"): string | null {
  const match = new RegExp(`(?:^|\\|)\\s*${kind}:\\s*([^|]+)`, "i").exec(mention);
  if (match?.[1]?.trim()) return match[1].trim();
  return kind === "person" && !/person:|project:/i.test(mention) ? mention.trim() : null;
}

function same(candidate: string, mention: string): boolean {
  return candidate.trim().toLocaleLowerCase() === mention.trim().toLocaleLowerCase();
}
