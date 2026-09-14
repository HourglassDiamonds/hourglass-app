import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AskConciergeAnswerView } from "../../../app/executive-dashboard/concierge/components/ask-concierge-answer";
import { runConciergeSol } from "./runtime";
import { executeConciergeTool } from "./tool-runtime";
import { CONCIERGE_WRITE_TOOL_NAMES } from "./tools";
import type { ReasoningBrain } from "./types";
import { deterministicToolPlan } from "./fallback";
import {
  TRAVIS_PERSON_ID as PERSON_ID,
  createTravisSolWorld,
} from "./travis-world";

function travisWorld(options?: { throwOnPeople?: boolean }) {
  return createTravisSolWorld(options);
}

class ScriptedSol implements ReasoningBrain {
  readonly id = "sol";
  readonly model = "gpt-5.6-sol";
  private round = 0;
  constructor(private readonly fail = false) {}
  async complete(input: Parameters<ReasoningBrain["complete"]>[0]) {
    if (this.fail) throw new Error("openai-unavailable");
    const last = [...input.messages].reverse().find((row) => row.role === "user")?.content ?? "";
    if (this.round === 0) {
      this.round += 1;
      return {
        usage: { model: this.model, promptTokens: 80, completionTokens: 20 },
        turn: {
          kind: "tool_calls" as const,
          calls: deterministicToolPlan({ query: last, mode: input.mode }),
        },
      };
    }
    return {
      usage: { model: this.model, promptTokens: 40, completionTokens: 30 },
      turn: { kind: "message" as const, text: "Continuum already has the tool result." },
    };
  }
}

describe("Concierge Sol runtime", () => {
  it("answers November birthdays from the birthday tool", async () => {
    const answer = await runConciergeSol({
      query: "Who has a birthday in November?",
      world: travisWorld(),
    });
    assert.match(answer.text, /Sarah Miller/);
    assert.match(answer.text, /November/);
    assert.ok(answer.telemetry.toolNames.includes("get_birthdays"));
    assert.equal(answer.writesCanonical, false);
  });

  it("summarizes Travis without collapsing the finger-size conflict", async () => {
    const going = await runConciergeSol({
      query: "What is going on with Travis?",
      world: travisWorld(),
    });
    assert.match(going.text, /Travis/);
    assert.match(going.text, /Chicken ring/);

    const size = await runConciergeSol({
      query: "What finger size do we have for Travis?",
      world: travisWorld(),
    });
    assert.match(size.text, /Canonical finger size is 12\.5/);
    assert.match(size.text, /pending proposal for 11/);
    assert.match(size.text, /could not be verified/);

    const origin = await runConciergeSol({
      query: "Where did the 11 come from?",
      history: [
        { role: "founder", text: "What is going on with Travis?" },
        { role: "concierge", text: going.text },
      ],
      world: travisWorld(),
    });
    assert.match(origin.text, /11/);
    assert.match(origin.text, /could not be verified|pending proposal/);
    assert.equal(origin.writesCanonical, false);
  });

  it("grounds provenance from conversation referent when Sol omits person ids", async () => {
    class EmptyArgSol implements ReasoningBrain {
      readonly id = "sol";
      readonly model = "gpt-5.6-sol";
      private round = 0;
      async complete() {
        if (this.round === 0) {
          this.round += 1;
          return {
            usage: { model: this.model, promptTokens: 20, completionTokens: 10 },
            turn: {
              kind: "tool_calls" as const,
              calls: [{ id: "call_prov", name: "get_provenance_summary", arguments: {} }],
            },
          };
        }
        return {
          usage: { model: this.model, promptTokens: 10, completionTokens: 10 },
          turn: { kind: "message" as const, text: "I could not find a source." },
        };
      }
    }
    const answer = await runConciergeSol({
      query: "Where did that come from?",
      history: [
        { role: "founder", text: "What finger size do we have for Travis Morse?" },
        { role: "concierge", text: "Canonical finger size is 12.5." },
      ],
      world: travisWorld(),
      brain: new EmptyArgSol(),
    });
    assert.equal(answer.telemetry.brain, "sol");
    assert.ok(answer.telemetry.toolNames.includes("get_provenance_summary"));
    assert.match(answer.text, /12\.5/);
    assert.match(answer.text, /pending proposal for 11/);
    assert.match(answer.text, /could not be verified/);
  });

  it("prefers a populated provenance fact over an empty parallel tool result", async () => {
    class ParallelProvenanceSol implements ReasoningBrain {
      readonly id = "sol";
      readonly model = "gpt-5.6-sol";
      private round = 0;
      async complete() {
        if (this.round === 0) {
          this.round += 1;
          return {
            usage: { model: this.model, promptTokens: 20, completionTokens: 10 },
            turn: {
              kind: "tool_calls" as const,
              calls: [
                { id: "empty", name: "get_provenance_summary", arguments: { query: "zzz-nobody" } },
                { id: "travis", name: "get_provenance_summary", arguments: { query: "Travis Morse" } },
              ],
            },
          };
        }
        return {
          usage: { model: this.model, promptTokens: 10, completionTokens: 10 },
          turn: { kind: "message" as const, text: "No size on file." },
        };
      }
    }
    const answer = await runConciergeSol({
      query: "What finger size do we have for Travis Morse?",
      world: travisWorld(),
      brain: new ParallelProvenanceSol(),
    });
    assert.equal(answer.telemetry.brain, "sol");
    assert.match(answer.text, /Canonical finger size is 12\.5/);
    assert.match(answer.text, /pending proposal for 11/);
    assert.doesNotMatch(answer.text, /does not have a recorded finger size yet/);
  });

  it("lists waiting-on-you and waiting-on-client from operating state", async () => {
    const mine = await runConciergeSol({
      query: "Which projects are waiting on me?",
      world: travisWorld(),
    });
    assert.match(mine.text, /Chicken ring/);
    const client = await runConciergeSol({
      query: "Which projects are waiting on the client?",
      world: travisWorld(),
    });
    assert.match(client.text, /Lee \/ Spiegel/);
  });

  it("returns the laser sizing quote and never a guessed price", async () => {
    const answer = await runConciergeSol({
      query: "How much does a 14KY sizing on a 2mm shank cost from 6 to 7?",
      world: travisWorld(),
      brain: new ScriptedSol(),
    });
    assert.match(answer.text, /\$135/);
    assert.match(answer.text, /laser/i);
    assert.doesNotMatch(answer.text, /\$1,000/);
    assert.ok(answer.telemetry.toolNames.includes("get_repair_quote"));
    assert.equal(answer.telemetry.brain, "sol");
  });

  it("returns the latest project email snippet", async () => {
    const answer = await runConciergeSol({
      query: "What did the latest email say about chicken ring?",
      world: travisWorld(),
    });
    assert.match(answer.text, /chicken ring CAD/i);
    assert.ok(answer.actions.some((row) => row.kind === "view-email"));
  });

  it("returns top three Today items", async () => {
    const answer = await runConciergeSol({
      query: "What are my top three things to handle today?",
      world: travisWorld(),
    });
    assert.match(answer.text, /Send CAD/);
    assert.match(answer.text, /Follow up/);
    assert.match(answer.text, /Check production/);
  });

  it("says unknown Person and unknown Project without inventing records", async () => {
    const person = await runConciergeSol({
      query: "What is going on with Zorblax?",
      world: travisWorld(),
    });
    assert.match(person.text, /don't have a Person/i);
    const project = await runConciergeSol({
      query: "Find project QX-999-not-real",
      world: travisWorld(),
    });
    assert.match(project.text, /don't have a Project/i);
  });

  it("falls back when a tool throws and when Sol is unavailable", async () => {
    const failedTool = await executeConciergeTool(
      travisWorld({ throwOnPeople: true }),
      "find_person",
      { query: "Travis" },
    );
    assert.equal(failedTool.ok, false);
    const failedBrain = await runConciergeSol({
      query: "How much does a 14KY sizing on a 2mm shank cost from 6 to 7?",
      world: travisWorld(),
      brain: new ScriptedSol(true),
    });
    assert.match(failedBrain.text, /\$135/);
    assert.equal(failedBrain.telemetry.brain, "fallback");
    assert.doesNotMatch(failedBrain.text, /Sol answered/i);
  });

  it("routes Design Mode to project specs instead of a person-status summary", async () => {
    const answer = await runConciergeSol({
      query: "What is going on with Travis?",
      mode: "design",
      world: travisWorld(),
    });
    assert.equal(answer.mode, "design");
    assert.ok(answer.telemetry.toolNames.includes("get_project_specs"));
    assert.match(answer.text, /Finger size: 12\.5/);
  });

  it("keeps Brain Dump as a non-persisting proposal", async () => {
    const answer = await runConciergeSol({
      query: "Need to follow up with Travis on CAD.",
      mode: "brain-dump",
      world: travisWorld(),
    });
    assert.equal(answer.mode, "brain-dump");
    assert.equal(answer.brainDump?.persist, false);
    assert.match(answer.text, /Nothing has been saved/);
  });

  it("exposes write proposals without writing", async () => {
    assert.deepEqual([...CONCIERGE_WRITE_TOOL_NAMES], []);
    const result = await executeConciergeTool(travisWorld(), "propose_canonical_change", {
      kind: "finger_size",
      proposedValue: "11",
      summary: "Change Travis to 11",
    });
    assert.equal(result.data.persist, false);
    assert.equal(result.data.writesCanonical, false);
  });
});

describe("Concierge Sol answer UI", () => {
  it("renders conversation text and evidence actions without telemetry", () => {
    const html = renderToStaticMarkup(
      createElement(AskConciergeAnswerView, {
        answer: {
          kind: "conversation",
          mode: "conversation",
          text: "Canonical finger size is 12.5.",
          actions: [
            {
              kind: "open-person",
              label: "Travis Morse",
              href: `/executive-dashboard/concierge/client/${PERSON_ID}`,
            },
          ],
          brainDump: null,
          writesCanonical: false,
          telemetry: {
            requestModel: "gpt-5.6-sol",
            brain: "sol",
            promptTokens: 99,
            completionTokens: 40,
            latencyMs: 1200,
            toolCount: 2,
            toolNames: ["get_provenance_summary"],
          },
        },
      }),
    );
    assert.match(html, /Canonical finger size is 12\.5/);
    assert.match(html, /Travis Morse/);
    assert.doesNotMatch(html, /promptTokens|gpt-5\.6|get_provenance_summary|99/);
  });
});
