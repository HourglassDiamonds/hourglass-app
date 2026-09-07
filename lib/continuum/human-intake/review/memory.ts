import { randomUUID } from "node:crypto";
import type { CandidateStore } from "@/lib/continuum/candidates/types";
import type { InMemoryClientMemoryStore } from "@/lib/continuum/client-memory/store";
import { createInMemoryClientMemoryNoteWriter } from "@/lib/continuum/client-memory/write/writer";
import { createInMemoryClientMemoryProjectSpecWriter } from "@/lib/continuum/client-memory/project-spec/writer";
import { createProjectJob } from "@/lib/continuum/client-memory/project-jobs/create";
import type { InMemoryProjectJobStore } from "@/lib/continuum/client-memory/project-jobs/store";
import type { InMemoryHumanSourceStore } from "@/lib/continuum/client-memory/human-intake/store";
import type { ReviewHumanIntakeCandidateDeps } from "./apply";

export function createMemoryHumanIntakeReviewDeps(input: {
  candidates: CandidateStore;
  sources: InMemoryHumanSourceStore;
  memory: InMemoryClientMemoryStore;
  jobs: InMemoryProjectJobStore;
  nowIso?: () => string;
}): ReviewHumanIntakeCandidateDeps {
  const notes = createInMemoryClientMemoryNoteWriter(input.memory);
  const specs = createInMemoryClientMemoryProjectSpecWriter(input.memory);
  const nowIso = input.nowIso ?? (() => new Date().toISOString());
  return {
    nowIso,
    candidates: input.candidates,
    getSource: (id) => input.sources.getSource(id),
    listLinks: (id) => input.sources.listLinks(id),
    getPersonName: (id) => input.sources.getPersonName(id),
    getProjectTitle: (id) => input.sources.getProjectTitle(id),
    personOnProject: (personId, projectId) =>
      input.memory.hasActiveClientProjectLink(personId, projectId),
    updateSourceReviewStatus: (sourceId, status, updatedAt) =>
      input.sources.updateSourceReviewStatus(sourceId, status, updatedAt),
    confirmSourceLink: (link) => input.sources.confirmSourceLink(link),
    addManualNote: (payload) => notes.addManualNote(payload),
    correctProjectSpec: (payload) => specs.correctProjectSpec(payload),
    createProjectJob: (payload) =>
      createProjectJob(
        {
          nowIso,
          newJobId: () => randomUUID(),
          getEntity: (id) => input.memory.getEntity(id),
          getProjectProfile: (projectId) =>
            input.memory.getProjectProfile(projectId),
          getPersonProfile: (personId) => input.memory.getPersonProfile(personId),
          hasActiveClientProjectRelationship: (projectId, personId) =>
            input.memory.hasActiveClientProjectLink(personId, projectId),
          applyCreate: async (job) => input.jobs.insertJob(job),
        },
        payload,
      ),
  };
}
