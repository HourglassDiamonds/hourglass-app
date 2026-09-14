import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OpenAiSolBrain } from "./openai";
import { CONCIERGE_SOL_RESPONSES_ENDPOINT } from "./models";
import { openaiResponsesToolPayloads } from "./tools";

describe("OpenAI Sol Responses client", () => {
  it("posts to Responses with store disabled and flat function tools", async () => {
    const payloads = openaiResponsesToolPayloads();
    assert.equal(payloads[0]?.type, "function");
    assert.equal(typeof payloads[0]?.name, "string");
    assert.equal(payloads[0]?.strict, false);
    assert.ok(payloads.some((row) => row.name === "get_repair_quote"));

    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url: String(url), body });
      return new Response(
        JSON.stringify({
          model: "gpt-5.6-sol",
          usage: { input_tokens: 120, output_tokens: 18 },
          output: [
            {
              type: "function_call",
              call_id: "call_repair",
              name: "get_repair_quote",
              arguments: JSON.stringify({ query: "14KY sizing 2mm 6 to 7" }),
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const brain = new OpenAiSolBrain("sk-test", "gpt-5.6-sol");
      const first = await brain.complete({
        mode: "conversation",
        system: "Use Continuum tools.",
        tools: [],
        messages: [{ role: "user", content: "How much does a 14KY sizing on a 2mm shank cost from 6 to 7?" }],
      });
      assert.equal(brain.endpoint, CONCIERGE_SOL_RESPONSES_ENDPOINT);
      assert.equal(calls[0]?.url, CONCIERGE_SOL_RESPONSES_ENDPOINT);
      assert.equal(calls[0]?.body.model, "gpt-5.6-sol");
      assert.equal(calls[0]?.body.store, false);
      assert.equal(first.turn.kind, "tool_calls");
      if (first.turn.kind !== "tool_calls") throw new Error("expected tool calls");
      assert.equal(first.turn.calls[0]?.name, "get_repair_quote");
      assert.equal(first.usage.model, "gpt-5.6-sol");

      globalThis.fetch = (async () => {
        return new Response(
          JSON.stringify({
            model: "gpt-5.6-sol",
            usage: { input_tokens: 80, output_tokens: 40 },
            output_text: "Use the Continuum quote.",
            output: [{ type: "message", content: [{ type: "output_text", text: "Use the Continuum quote." }] }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch;

      const second = await brain.complete({
        mode: "conversation",
        system: "Use Continuum tools.",
        tools: [],
        messages: [
          { role: "user", content: "How much does a 14KY sizing on a 2mm shank cost from 6 to 7?" },
          {
            role: "tool",
            name: "get_repair_quote",
            callId: "call_repair",
            content: JSON.stringify({ quoted: true, clientAnswer: "$135 laser" }),
          },
        ],
      });
      assert.equal(second.turn.kind, "message");
      assert.equal(second.usage.promptTokens, 80);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("retries rate-limited Responses calls and does not retry exhausted credits", async () => {
    const original = globalThis.fetch;
    const urls: string[] = [];
    let rateLimited = 0;
    globalThis.fetch = (async (url: string) => {
      urls.push(String(url));
      if (rateLimited === 0) {
        rateLimited += 1;
        return new Response(
          JSON.stringify({
            error: { type: "requests", code: "rate_limit_exceeded" },
          }),
          { status: 429, headers: { "retry-after": "0", "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          model: "gpt-5.6-sol",
          usage: { input_tokens: 10, output_tokens: 4 },
          output_text: "ok",
          output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      const brain = new OpenAiSolBrain("sk-test", "gpt-5.6-sol");
      const result = await brain.complete({
        mode: "conversation",
        system: "x",
        tools: [],
        messages: [{ role: "user", content: "hi" }],
      });
      assert.equal(result.turn.kind, "message");
      assert.equal(urls.length, 2);
      assert.equal(brain.lastApiFailure, null);
    } finally {
      globalThis.fetch = original;
    }

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: { type: "insufficient_quota", code: "credit_balance_exhausted" },
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    try {
      const brain = new OpenAiSolBrain("sk-test", "gpt-5.6-sol");
      await assert.rejects(
        () =>
          brain.complete({
            mode: "conversation",
            system: "x",
            tools: [],
            messages: [{ role: "user", content: "hi" }],
          }),
        /openai-unavailable/,
      );
      assert.equal(brain.lastApiFailure?.errorCode, "credit_balance_exhausted");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("throws when the Responses API is unavailable", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response("no", { status: 503 })) as typeof fetch;
    try {
      const brain = new OpenAiSolBrain("sk-test");
      await assert.rejects(
        () =>
          brain.complete({
            mode: "conversation",
            system: "x",
            tools: [],
            messages: [{ role: "user", content: "hi" }],
          }),
        /openai-unavailable/,
      );
      assert.equal(brain.lastApiFailure?.httpStatus, 503);
    } finally {
      globalThis.fetch = original;
    }
  });
});
