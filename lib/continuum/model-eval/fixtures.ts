import { CONCIERGE_TOOL_NAMES } from "../concierge-sol/tools";
import type { EvalFixture } from "./types";

export const CONTINUUM_MODEL_EVAL_FIXTURES: readonly EvalFixture[] = [
  { id: "client-recall-profile", category: "client-recall", description: "Recall a known client's current project.", query: "What do we know about Travis Morse?", expected: { anyTools: ["find_person", "get_person_summary", "get_client_history"], textIncludes: ["Travis"] } },
  { id: "client-recall-history", category: "client-recall", description: "Retrieve relationship history without inventing it.", query: "Give me the relationship history for Travis.", expected: { anyTools: ["find_person", "get_client_history"] } },
  { id: "client-birthday", category: "client-recall", description: "Recall a dated client fact.", query: "Whose birthday is in November?", expected: { allTools: ["get_birthdays"], textIncludes: ["Sarah"] } },
  { id: "project-recall-summary", category: "project-recall", description: "Recall the known chicken ring project.", query: "Where are we with the chicken ring?", expected: { anyTools: ["find_project", "get_project_summary"] } },
  { id: "project-recall-spec", category: "project-recall", description: "Get a project spec with provenance restraint.", query: "What's Travis's ring size and how sure are we?", expected: { anyTools: ["get_provenance_summary", "get_source_evidence"], textIncludes: ["12.5"], textExcludes: ["definitely 11"] } },
  { id: "project-recall-history", category: "project-recall", description: "Retrieve project history.", query: "What changed on the Travis chicken ring project?", expected: { anyTools: ["get_project_history", "get_provenance_summary"] } },
  { id: "missing-overview", category: "what-am-i-missing", description: "Synthesize missing attention across queues.", query: "What am I missing right now?", expected: { anyTools: ["get_today_items", "get_open_commitments", "get_waiting_state"] } },
  { id: "missing-followups", category: "what-am-i-missing", description: "Find neglected founder follow-ups.", query: "Anything slipping through the cracks?", expected: { anyTools: ["get_today_items", "get_open_commitments", "get_waiting_state"] } },
  { id: "next-three", category: "next-three-best-things", description: "Prioritize exactly the next useful work.", query: "What are the next three best things I should do?", expected: { anyTools: ["get_today_items", "get_open_commitments"] } },
  { id: "next-three-projects", category: "next-three-best-things", description: "Prioritize from active projects.", query: "Give me my top three moves across current projects.", expected: { anyTools: ["get_today_items", "get_current_projects", "get_open_commitments"] } },
  { id: "who-needs-me", category: "who-needs-me", description: "Identify founder-owned work.", query: "Who needs me today?", expected: { anyTools: ["get_today_items", "get_open_commitments"] } },
  { id: "who-waiting-client", category: "who-needs-me", description: "Separate client waits from founder work.", query: "Who are we waiting on, and who is waiting on me?", expected: { anyTools: ["get_waiting_state", "get_waiting_on_client", "get_open_commitments"] } },
  { id: "gmail-latest", category: "gmail-reasoning", description: "Read targeted project email evidence.", query: "What did the latest email say about the chicken ring CAD?", expected: { anyTools: ["search_gmail_evidence", "get_recent_project_email"] } },
  { id: "gmail-targeted", category: "gmail-reasoning", description: "Search Gmail narrowly for a known person.", query: "Did Travis email us about proceeding with the CAD?", expected: { anyTools: ["search_gmail_evidence", "get_recent_project_email"] } },
  { id: "tool-price", category: "tool-selection", description: "Use deterministic quote tooling rather than arithmetic.", query: "Quote a 14K yellow gold laser sizing from 10 to 11.", expected: { allTools: ["get_repair_quote"] } },
  { id: "tool-notes", category: "tool-selection", description: "Search notes rather than broad project state.", query: "Search my notes for chicken ring design decisions.", expected: { anyTools: ["search_notes", "get_project_notes"] } },
  { id: "ambiguous-vincent", category: "ambiguous-identities", description: "Do not resolve an absent Vincent by guesswork.", query: "What size did Vincent land on?", expected: { anyTools: ["find_person", "find_project"], textExcludes: ["Vincent's size is"] } },
  { id: "ambiguous-lee", category: "ambiguous-identities", description: "Do not infer a full identity from a first name.", query: "Tell me everything about Lee.", expected: { anyTools: ["find_person", "find_project"], textExcludes: ["Lee's email is"] } },
  { id: "unsupported-budget", category: "unsupported-fact-restraint", description: "Decline to invent a client budget.", query: "What is Travis's budget?", expected: { anyTools: ["find_person", "get_person_summary", "get_client_history"], textExcludes: ["$5,000", "$5000"] } },
  { id: "unsupported-deadline", category: "unsupported-fact-restraint", description: "Decline to invent a delivery deadline.", query: "When did we promise Travis the ring would be done?", expected: { anyTools: ["get_project_history", "search_gmail_evidence", "get_project_notes"], textExcludes: ["September 30"] } },
  { id: "multi-intent-founder", category: "multiple-intents", description: "Separate two reminders and two people in messy founder language.", mode: "brain-dump", query: "Just got a text from Vincent asking to update the CAD. Remind me tomorrow morning, and today at 1 I need to finish curing Nate's resin.", expected: { structuredCapture: true, forbiddenTools: ["propose_canonical_change"] } },
  { id: "multi-intent-client-project", category: "multiple-intents", description: "Handle recall plus a follow-up request without claiming it was saved.", mode: "brain-dump", query: "Travis approved the chicken ring CAD, note that, and remind me Friday to call the shop.", expected: { structuredCapture: true, forbiddenTools: ["propose_canonical_change"] } },
  { id: "capture-personal", category: "structured-capture", description: "Classify personal and business context.", mode: "brain-dump", query: "Sarah's birthday is November 12 and I should send flowers a week before.", expected: { structuredCapture: true } },
  { id: "capture-project-action", category: "structured-capture", description: "Classify project, action, and follow-up.", mode: "brain-dump", query: "Need to text Travis about the chicken ring CAD after lunch.", expected: { structuredCapture: true } },
  { id: "deadline-relative", category: "deadlines-reminders", description: "Interpret relative time while preserving the source wording.", mode: "brain-dump", query: "Remind me tomorrow morning to check the Travis CAD.", expected: { structuredCapture: true } },
  { id: "deadline-two-times", category: "deadlines-reminders", description: "Keep two time-bound actions distinct.", mode: "brain-dump", query: "At 1 today cure Nate's resin, then tomorrow morning update Vincent's CAD.", expected: { structuredCapture: true } },
  { id: "no-write-spec", category: "no-canonical-writes", description: "A requested spec change remains a proposal.", query: "Change Travis's finger size to 11.", expected: { anyTools: ["propose_canonical_change", "get_provenance_summary"], textExcludes: ["I've changed", "saved"] } },
  { id: "design-reasoning", category: "design-project-reasoning", description: "Use project specs in Design mode.", mode: "design", query: "For the Travis chicken ring, recap the metal, size, and CAD status before I revise the design.", expected: { anyTools: ["find_project", "get_project_specs", "get_project_summary"], textIncludes: ["12.5"] } },
];

export function validateEvalFixtures(fixtures: readonly EvalFixture[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const fixture of fixtures) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fixture.id)) errors.push(`${fixture.id}: id must be kebab-case`);
    if (ids.has(fixture.id)) errors.push(`${fixture.id}: duplicate id`);
    ids.add(fixture.id);
    if (!fixture.category.trim() || !fixture.description.trim() || !fixture.query.trim()) errors.push(`${fixture.id}: category, description, and query are required`);
    const namedTools = [...(fixture.expected.anyTools ?? []), ...(fixture.expected.allTools ?? []), ...(fixture.expected.forbiddenTools ?? [])];
    for (const tool of namedTools) if (!CONCIERGE_TOOL_NAMES.includes(tool)) errors.push(`${fixture.id}: unknown tool ${tool}`);
    if (fixture.expected.structuredCapture && fixture.mode !== "brain-dump") errors.push(`${fixture.id}: structured capture requires brain-dump mode`);
  }
  return errors;
}
