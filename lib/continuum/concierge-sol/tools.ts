/**
 * Concierge V1 tool catalog. Read + propose only.
 * Continuum executes tools. Sol never sees SQL, secrets, or write handles.
 */

import type { ConciergeToolDefinition, ConciergeToolJson } from "./types";

const EMPTY_OBJECT = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const;

function queryTool(description: string, extra?: ConciergeToolDefinition["parameters"]["properties"]): ConciergeToolDefinition {
  return {
    name: "",
    description,
    write: false,
    proposal: false,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Founder-facing search text or name." },
        ...(extra ?? {}),
      },
    },
  };
}

function named(name: string, def: Omit<ConciergeToolDefinition, "name">): ConciergeToolDefinition {
  return { ...def, name };
}

export const CONCIERGE_TOOL_DEFINITIONS: readonly ConciergeToolDefinition[] = [
  named("find_person", queryTool("Find a Person by name or organization. Returns matches, not a guess.")),
  named(
    "get_person_summary",
    queryTool("Canonical Person summary: identity, linked projects, current specs, open work.", {
      personId: { type: "string" },
    }),
  ),
  named(
    "get_client_history",
    queryTool("Client relationship history: projects, notes, and facts already in Continuum.", {
      personId: { type: "string" },
    }),
  ),
  named(
    "get_birthdays",
    {
      description: "List People with a recorded birthday in a calendar month.",
      write: false,
      proposal: false,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          month: { type: "integer", minimum: 1, maximum: 12 },
          query: { type: "string" },
        },
      },
    },
  ),
  named("find_project", queryTool("Find a Project by title, person name, or CAD/order identifier.")),
  named(
    "get_project_summary",
    queryTool("Canonical Project summary: people, lifecycle, specs, current action.", {
      projectId: { type: "string" },
    }),
  ),
  named(
    "get_project_specs",
    queryTool("Canonical Project specs only. Does not collapse pending proposals.", {
      projectId: { type: "string" },
    }),
  ),
  named(
    "get_project_history",
    queryTool("Project history: spec corrections, notes, and recorded jobs.", {
      projectId: { type: "string" },
    }),
  ),
  named(
    "get_project_jobs",
    queryTool("Unresolved Open Jobs on a Project.", { projectId: { type: "string" } }),
  ),
  named("get_current_projects", {
    description: "Current Projects on the operating board.",
    write: false,
    proposal: false,
    parameters: EMPTY_OBJECT,
  }),
  named("get_waiting_state", {
    description: "Projects grouped by waiting state: founder, client, shop, production.",
    write: false,
    proposal: false,
    parameters: EMPTY_OBJECT,
  }),
  named("search_gmail_evidence", queryTool("Search indexed Gmail metadata for a Person or Project. Does not dump the mailbox.")),
  named(
    "get_recent_project_email",
    queryTool("Latest indexed email on a known Project thread.", {
      projectId: { type: "string" },
    }),
  ),
  named(
    "get_source_evidence",
    queryTool("Exact source pointer and provenance for a fact or proposal.", {
      personId: { type: "string" },
      projectId: { type: "string" },
      fieldName: { type: "string" },
    }),
  ),
  named(
    "get_provenance_summary",
    queryTool("Canonical facts versus pending/conflicting evidence, with provenance labels.", {
      personId: { type: "string" },
      projectId: { type: "string" },
      fieldName: { type: "string" },
    }),
  ),
  named(
    "get_repair_quote",
    {
      description:
        "Deterministic Hourglass repair quote. Never invent a price. Laser-only for sizing unless Continuum has no laser SKU.",
      write: false,
      proposal: false,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          metal: { type: "string" },
          repairType: { type: "string" },
          shankMm: { type: "number" },
          fromSize: { type: "number" },
          toSize: { type: "number" },
          stoneCount: { type: "number" },
        },
      },
    },
  ),
  named(
    "get_repair_context",
    queryTool("Repair policy and, when a Project is known, its repair context.", {
      projectId: { type: "string" },
    }),
  ),
  named("get_today_items", {
    description: "Bounded Today queue items the founder should handle.",
    write: false,
    proposal: false,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { limit: { type: "integer", minimum: 1, maximum: 5 } },
    },
  }),
  named("get_open_commitments", {
    description: "Unresolved founder-owned Open Jobs / commitments.",
    write: false,
    proposal: false,
    parameters: EMPTY_OBJECT,
  }),
  named("get_waiting_on_client", {
    description: "Current Projects waiting on the client.",
    write: false,
    proposal: false,
    parameters: EMPTY_OBJECT,
  }),
  named("get_waiting_on_shop", {
    description: "Current Projects waiting on the shop or vendor.",
    write: false,
    proposal: false,
    parameters: EMPTY_OBJECT,
  }),
  named("get_in_production", {
    description: "Current Projects in production.",
    write: false,
    proposal: false,
    parameters: EMPTY_OBJECT,
  }),
  named("search_notes", queryTool("Search Continuum notes. Returns matching note text only.")),
  named(
    "get_project_notes",
    queryTool("Notes already stored on a Project.", { projectId: { type: "string" } }),
  ),
  named(
    "propose_canonical_change",
    {
      description:
        "Propose a canonical write for founder approval. Does not persist. Does not email. Does not change jobs, people, specs, or quotes.",
      write: false,
      proposal: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string" },
          summary: { type: "string" },
          personId: { type: "string" },
          projectId: { type: "string" },
          fieldName: { type: "string" },
          proposedValue: { type: "string" },
        },
      },
    },
  ),
];

export const CONCIERGE_TOOL_NAMES = CONCIERGE_TOOL_DEFINITIONS.map((row) => row.name);

export const CONCIERGE_WRITE_TOOL_NAMES: readonly string[] = [];

export function conciergeToolByName(name: string): ConciergeToolDefinition | null {
  return CONCIERGE_TOOL_DEFINITIONS.find((row) => row.name === name) ?? null;
}

export function openaiToolPayloads(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: ConciergeToolJson };
}> {
  return CONCIERGE_TOOL_DEFINITIONS.map((row) => ({
    type: "function" as const,
    function: {
      name: row.name,
      description: row.description,
      parameters: row.parameters,
    },
  }));
}

export function openaiResponsesToolPayloads(): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: ConciergeToolJson;
  strict: false;
}> {
  return CONCIERGE_TOOL_DEFINITIONS.map((row) => ({
    type: "function" as const,
    name: row.name,
    description: row.description,
    parameters: row.parameters,
    strict: false as const,
  }));
}
