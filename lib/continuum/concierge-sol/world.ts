/**
 * Continuum-owned data port for Concierge tools.
 * Implementations may read; they must not write canonical state.
 */

import type { BirthdayRead } from "@/lib/continuum/client-memory/facts/types";
import type { CurrentProjectCard } from "@/lib/continuum/client-memory/open-projects/card";
import type { CurrentProjectOperatingGroup } from "@/lib/continuum/client-memory/open-projects/operating-groups";
import type {
  ProjectDeskGetResult,
  ProjectDeskSummary,
} from "@/lib/continuum/client-memory/project-desk/types";
import type {
  ClientSearchResult,
  ConciergePersonProfileResult,
} from "@/lib/continuum/client-memory/read/types";
import type { GmailIndexedMessage } from "@/lib/continuum/client-memory/gmail/types";
import type { ContinuumCandidate } from "@/lib/continuum/candidates/types";

export type TodayQueueItem = {
  title: string;
  detail: string;
  projectTitle: string | null;
  personName: string | null;
};

export type NoteHit = {
  noteText: string;
  createdAt: string;
  contextLayer?: string | null;
};

export type ProjectEmailHit = {
  subject: string | null;
  sentAt: string | null;
  direction: string | null;
  snippet: string | null;
  href: string | null;
};

export type ConciergeSolWorld = {
  searchPeople(query: string): Promise<ClientSearchResult[]>;
  getPersonProfile(personId: string): Promise<ConciergePersonProfileResult>;
  listBirthdaysByMonth(month: number): Promise<BirthdayRead[]>;
  listProjects(): Promise<ProjectDeskSummary[]>;
  getProjectDesk(projectId: string): Promise<ProjectDeskGetResult>;
  listCurrentProjectCards(): Promise<CurrentProjectCard[]>;
  groupCurrentProjects(nowIso: string): Promise<CurrentProjectOperatingGroup[]>;
  listCandidates(): Promise<ContinuumCandidate[]>;
  searchGmailSubjects(tokens: readonly string[]): Promise<GmailIndexedMessage[]>;
  listGmailByThread(threadId: string): Promise<GmailIndexedMessage[]>;
  fetchProjectEmail(input: {
    threadId: string;
    messageId?: string | null;
  }): Promise<ProjectEmailHit | null>;
  loadTodayItems(limit: number): Promise<TodayQueueItem[]>;
  searchNotes(query: string): Promise<NoteHit[]>;
};
