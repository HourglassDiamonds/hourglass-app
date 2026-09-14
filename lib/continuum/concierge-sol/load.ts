/**
 * Server-only Concierge Sol world. Founder session required.
 * Read adapters only. No canonical writes.
 */

import "server-only";

import { getAuthenticatedCandidateStore } from "@/lib/continuum/candidates/load";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";
import { loadCosOperatingLoop } from "@/lib/continuum/chief-of-staff/operating-loop/load";
import { loadCurrentProjectCards } from "@/lib/continuum/client-memory/open-projects/load";
import { groupCurrentProjects } from "@/lib/continuum/client-memory/open-projects/operating-groups";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedClientMemoryReader } from "@/lib/continuum/client-memory/read/load";
import { getAuthenticatedGmailHistoryStores } from "@/lib/continuum/gmail/load";
import { executeLiveSourceViewerFetch } from "@/lib/continuum/gmail/source-viewer-run";
import type { ConciergeSolWorld, ProjectEmailHit } from "./world";

export type LoadedConciergeWorld =
  | { ok: true; world: ConciergeSolWorld }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function loadConciergeSolWorld(): Promise<LoadedConciergeWorld> {
  const people = await getAuthenticatedClientMemoryReader();
  if (!people.ok) return { ok: false, reason: people.reason };
  const projects = await getAuthenticatedProjectDeskReader();
  if (!projects.ok) return { ok: false, reason: projects.reason };

  const world: ConciergeSolWorld = {
    searchPeople: (query) => people.reader.searchPeople(query),
    getPersonProfile: (personId) => people.reader.getPersonProfile(personId),
    listBirthdaysByMonth: (month) => people.reader.listCurrentBirthdaysByMonth(month),
    listProjects: () => projects.reader.listProjects(),
    getProjectDesk: (projectId) => projects.reader.getProjectDesk(projectId),
    async listCurrentProjectCards() {
      return loadCurrentProjectCards();
    },
    async groupCurrentProjects(nowIso) {
      const cards = await loadCurrentProjectCards();
      return groupCurrentProjects(cards, { nowIso, viewport: "mobile" });
    },
    async listCandidates() {
      const store = await getAuthenticatedCandidateStore();
      if (!store.ok) return [] as ContinuumCandidate[];
      return store.store.list();
    },
    async searchGmailSubjects(tokens) {
      const gmail = await getAuthenticatedGmailHistoryStores();
      if (!gmail.ok) return [];
      return gmail.index.listMessagesMatchingSubjectTokens(tokens);
    },
    async listGmailByThread(threadId) {
      const gmail = await getAuthenticatedGmailHistoryStores();
      if (!gmail.ok) return [];
      return gmail.index.listMessagesByThread(threadId);
    },
    async fetchProjectEmail(input) {
      return fetchIndexedEmail(input);
    },
    async loadTodayItems(limit) {
      const loop = await loadCosOperatingLoop();
      return loop.top5.slice(0, Math.max(1, Math.min(limit, 5))).map((item) => ({
        title: item.action,
        detail: item.why,
        projectTitle: item.projectTitle,
        personName: item.clientLabel,
      }));
    },
    async searchNotes(query) {
      const needle = query.toLowerCase();
      const listed = await projects.reader.listProjects({ limit: 40 });
      const notes: Array<{ noteText: string; createdAt: string; contextLayer?: string | null }> = [];
      for (const row of listed.slice(0, 12)) {
        const desk = await projects.reader.getProjectDesk(row.projectId);
        if (!desk.ok) continue;
        for (const note of desk.desk.notes) {
          if (note.noteText.toLowerCase().includes(needle)) {
            notes.push({
              noteText: note.noteText,
              createdAt: note.createdAt,
              contextLayer: note.contextLayer,
            });
          }
        }
      }
      return notes.slice(0, 8);
    },
  };
  return { ok: true, world };
}

async function fetchIndexedEmail(input: {
  threadId: string;
  messageId?: string | null;
}): Promise<ProjectEmailHit | null> {
  if (!input.threadId.trim()) return null;
  const fetched = await executeLiveSourceViewerFetch({
    founderSessionOk: true,
    threadId: input.threadId,
    messageId: input.messageId,
  });
  if (!fetched.ok) return null;
  const focused =
    fetched.messages.find((row) => row.messageId === input.messageId) ??
    fetched.messages[fetched.messages.length - 1] ??
    null;
  const snippet = (focused?.plainText || focused?.snippet || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400) || null;
  return {
    subject: fetched.indexedSubject ?? focused?.subject ?? null,
    sentAt: focused?.sentAt ?? null,
    direction: null,
    snippet,
    href: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(input.threadId)}${
      input.messageId ? `/${encodeURIComponent(input.messageId)}` : ""
    }`,
  };
}
