/**
 * Protected human-source persistence port and in-memory adapter.
 * Does not write Persons, facts, wishes, notes, project history, CoS, or kernel rows.
 */

import type { ClientMemoryEntity } from "../types";
import { ingestHumanSource } from "./ingest";
import type { HumanSourceIngestDeps } from "./ingest";
import { HUMAN_SOURCE_PREVIEW_MAX_LENGTH } from "./types";
import type {
  HumanSource,
  HumanSourceFileObject,
  HumanSourceLink,
  IngestHumanSourceInput,
  IngestHumanSourceResult,
} from "./types";

export type HumanSourceStore = {
  ingest(input: IngestHumanSourceInput): Promise<IngestHumanSourceResult>;
  getSource(id: string): Promise<HumanSource | null>;
  listSources(): Promise<HumanSource[]>;
  listLinks(sourceId: string): Promise<HumanSourceLink[]>;
  getPersonName(id: string): Promise<string | null>;
  getProjectTitle(id: string): Promise<string | null>;
};

export type HumanSourceNameLookup = {
  getEntity: (id: string) => Promise<Pick<ClientMemoryEntity, "kind"> | null>;
  getPersonName?: (id: string) => Promise<string | null>;
  getProjectTitle?: (id: string) => Promise<string | null>;
};

function cloneSource(row: HumanSource): HumanSource {
  return { ...row };
}

function cloneLink(row: HumanSourceLink): HumanSourceLink {
  return { ...row };
}

function linkKey(row: Pick<HumanSourceLink, "sourceId" | "entityId">): string {
  return `${row.sourceId}\0${row.entityId}`;
}

export class InMemoryHumanSourceStore implements HumanSourceStore {
  private readonly sources = new Map<string, HumanSource>();
  private readonly links = new Map<string, HumanSourceLink>();
  private readonly files = new Map<string, HumanSourceFileObject>();
  private readonly nowIso: () => string;
  private readonly newSourceId: () => string;
  private readonly names: HumanSourceNameLookup;

  constructor(input: {
    nowIso: () => string;
    newSourceId: () => string;
    names: HumanSourceNameLookup;
  }) {
    this.nowIso = input.nowIso;
    this.newSourceId = input.newSourceId;
    this.names = input.names;
  }

  ingest(input: IngestHumanSourceInput): Promise<IngestHumanSourceResult> {
    return ingestHumanSource(this.deps(), input);
  }

  async getSource(id: string): Promise<HumanSource | null> {
    const row = this.sources.get(id.trim());
    return row ? cloneSource(row) : null;
  }

  async listSources(): Promise<HumanSource[]> {
    return [...this.sources.values()]
      .sort((a, b) => {
        if (a.ingestedAt === b.ingestedAt) return b.id.localeCompare(a.id);
        return a.ingestedAt < b.ingestedAt ? 1 : -1;
      })
      .map(cloneSource);
  }

  async listLinks(sourceId: string): Promise<HumanSourceLink[]> {
    const id = sourceId.trim();
    return [...this.links.values()]
      .filter((row) => row.sourceId === id)
      .map(cloneLink);
  }

  async getPersonName(id: string): Promise<string | null> {
    if (!this.names.getPersonName) return null;
    return this.names.getPersonName(id);
  }

  async getProjectTitle(id: string): Promise<string | null> {
    if (!this.names.getProjectTitle) return null;
    return this.names.getProjectTitle(id);
  }

  listFiles(): HumanSourceFileObject[] {
    return [...this.files.values()].map((row) => ({
      ...row,
      bytes: new Uint8Array(row.bytes),
    }));
  }

  private deps(): HumanSourceIngestDeps {
    return {
      nowIso: this.nowIso,
      newSourceId: this.newSourceId,
      getEntity: (id) => this.names.getEntity(id),
      findByExternalId: async (sourceType, externalSourceId) => {
        const found = [...this.sources.values()].find(
          (row) =>
            row.sourceType === sourceType &&
            row.externalSourceId === externalSourceId,
        );
        return found ? cloneSource(found) : null;
      },
      findByChecksum: async (sourceType, contentSha256) => {
        const found = [...this.sources.values()].find(
          (row) =>
            row.sourceType === sourceType &&
            row.contentSha256 === contentSha256,
        );
        return found ? cloneSource(found) : null;
      },
      listLinks: (sourceId) => this.listLinks(sourceId),
      insertSource: async (row) => {
        const byExternal =
          row.externalSourceId &&
          [...this.sources.values()].some(
            (existing) =>
              existing.sourceType === row.sourceType &&
              existing.externalSourceId === row.externalSourceId,
          );
        const byHash = [...this.sources.values()].some(
          (existing) =>
            existing.sourceType === row.sourceType &&
            existing.contentSha256 === row.contentSha256,
        );
        if (byExternal || byHash || this.sources.has(row.id)) {
          return "duplicate-key";
        }
        this.sources.set(row.id, cloneSource(row));
        return "inserted";
      },
      insertLink: async (row) => {
        const key = linkKey(row);
        if (this.links.has(key)) return "duplicate-key";
        this.links.set(key, cloneLink(row));
        return "inserted";
      },
      putFile: async (object) => {
        this.files.set(object.path, {
          path: object.path,
          mimeType: object.mimeType,
          bytes: new Uint8Array(object.bytes),
        });
      },
    };
  }
}

export function createInMemoryHumanSourceStore(input: {
  nowIso: () => string;
  newSourceId: () => string;
  names: HumanSourceNameLookup;
}): InMemoryHumanSourceStore {
  return new InMemoryHumanSourceStore(input);
}

export function sourcePreview(
  rawText: string | null,
  max = HUMAN_SOURCE_PREVIEW_MAX_LENGTH,
): string | null {
  if (rawText == null) return null;
  const collapsed = rawText.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max).trimEnd()}…`;
}
