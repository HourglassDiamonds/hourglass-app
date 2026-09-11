import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GENERATED_FOUNDER_OPERATING_BRIEF_RULE } from "@/lib/continuum/gmail/candidates/generated-source";
import { selectOpenEmailSources } from "./email-source";
import { parseGmailWebHref } from "./evidence";
import type { CosEvidenceBeat } from "./types";

const CLIENT_THREAD = "abc123def0";
const CLIENT_MSG = "aaa111bbb2";
const CLIENT_HREF = `https://mail.google.com/mail/u/0/#all/${CLIENT_THREAD}/${CLIENT_MSG}`;
const BRIEF_THREAD = "fed098cba1";
const BRIEF_MSG = "ccc222ddd3";
const BRIEF_HREF = `https://mail.google.com/mail/u/0/#all/${BRIEF_THREAD}/${BRIEF_MSG}`;
const OTHER_THREAD = "111222333a";
const OTHER_HREF = `https://mail.google.com/mail/u/0/#all/${OTHER_THREAD}/ddd333eee4`;

function beat(extra: Partial<CosEvidenceBeat> & Pick<CosEvidenceBeat, "candidateId">): CosEvidenceBeat {
  return {
    at: "Sep 8",
    label: "Sep 8 · Travis Morse → Justin",
    summary: "Size is 11",
    speaker: "client",
    sourceHref: CLIENT_HREF,
    ...extra,
  };
}

describe("Open Email provenance", () => {
  it("parses canonical Gmail web hrefs and rejects unsafe ids", () => {
    assert.deepEqual(parseGmailWebHref(CLIENT_HREF), {
      threadId: CLIENT_THREAD,
      messageId: CLIENT_MSG,
    });
    assert.equal(parseGmailWebHref("https://mail.google.com/mail/u/0/#all/not-a-thread"), null);
    assert.equal(parseGmailWebHref("/executive-dashboard/concierge/gmail/candidates"), null);
  });

  it("opens the client thread when a Morning Brief also restates the same work", () => {
    const sources = selectOpenEmailSources({
      specCandidateId: "cand-brief",
      canonicalThreadId: CLIENT_THREAD,
      beats: [
        beat({ candidateId: "cand-client" }),
        beat({
          at: "Sep 9",
          label: "Sep 9 · the client → Justin",
          summary: "Finger size 11",
          candidateId: "cand-brief",
          sourceHref: BRIEF_HREF,
          generatedSource: true,
        }),
      ],
    });
    assert.deepEqual(sources.map((row) => row.href), [CLIENT_HREF]);
    assert.equal(sources.some((row) => row.href === BRIEF_HREF), false);
  });

  it("excludes generated operating mail even without a stored project thread", () => {
    const sources = selectOpenEmailSources({
      specCandidateId: "cand-brief",
      beats: [
        beat({ candidateId: "cand-client" }),
        beat({
          candidateId: "cand-brief",
          sourceHref: BRIEF_HREF,
          generatedSource: true,
        }),
      ],
    });
    assert.deepEqual(sources.map((row) => row.href), [CLIENT_HREF]);
  });

  it("keeps a direct Gmail-derived item on its own thread", () => {
    const sources = selectOpenEmailSources({
      specCandidateId: "cand-client",
      beats: [beat({ candidateId: "cand-client" })],
    });
    assert.deepEqual(sources.map((row) => row.href), [CLIENT_HREF]);
  });

  it("fails closed when the only Gmail href is generated operating mail", () => {
    const generatedOnly = selectOpenEmailSources({
      canonicalThreadId: CLIENT_THREAD,
      fallbackHref: BRIEF_HREF,
      beats: [
        beat({
          candidateId: "cand-brief",
          sourceHref: BRIEF_HREF,
          generatedSource: true,
        }),
      ],
    });
    assert.deepEqual(generatedOnly, []);
    assert.equal(GENERATED_FOUNDER_OPERATING_BRIEF_RULE, "generated_founder_operating_brief");
  });

  it("does not let a poisoned project.gmailThreadId override a real client sourceRef", () => {
    const sources = selectOpenEmailSources({
      specCandidateId: "cand-brief",
      canonicalThreadId: BRIEF_THREAD,
      fallbackHref: BRIEF_HREF,
      beats: [
        beat({ candidateId: "cand-client" }),
        beat({
          candidateId: "cand-brief",
          sourceHref: BRIEF_HREF,
          generatedSource: true,
        }),
      ],
    });
    assert.deepEqual(sources.map((row) => row.href), [CLIENT_HREF]);
  });

  it("hides Open Email for an unassigned Brief-only item after generated tagging", () => {
    const liveHref = `https://mail.google.com/mail/u/0/#all/${BRIEF_THREAD}/${BRIEF_THREAD}`;
    const before = selectOpenEmailSources({
      beats: [
        beat({
          candidateId: "live-follow-up",
          sourceHref: liveHref,
          label: "Sep 9 · the client → Justin",
        }),
      ],
    });
    assert.deepEqual(before.map((row) => row.href), [liveHref]);

    const after = selectOpenEmailSources({
      beats: [
        beat({
          candidateId: "live-follow-up",
          sourceHref: liveHref,
          label: "Sep 9 · the client → Justin",
          generatedSource: true,
        }),
      ],
    });
    assert.deepEqual(after, []);
  });

  it("exposes a restrained chooser only when multiple real threads remain", () => {
    const sources = selectOpenEmailSources({
      beats: [
        beat({ candidateId: "cand-a" }),
        beat({
          candidateId: "cand-b",
          sourceHref: OTHER_HREF,
          label: "Sep 7 · vendor → Justin",
          speaker: "vendor",
        }),
      ],
    });
    assert.equal(sources.length, 2);
    assert.deepEqual(
      sources.map((row) => row.href).sort(),
      [OTHER_HREF, CLIENT_HREF].sort(),
    );
  });
});
