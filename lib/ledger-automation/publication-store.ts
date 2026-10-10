import type {
  LedgerPublication,
  LedgerPublicationEvent,
  LedgerPublicationPointer,
} from "./publication-types";

export type VersionedPointer = {
  pointer: LedgerPublicationPointer;
  version: string;
};

export interface LedgerPublicationStore {
  getPublication(publicationId: string): Promise<LedgerPublication | null>;
  appendPublication(publication: LedgerPublication): Promise<void>;
  getCurrentPointer(): Promise<VersionedPointer | null>;
  writeCurrentPointer(pointer: LedgerPublicationPointer, expectedVersion: string | null): Promise<VersionedPointer>;
  appendPublicationEvent(event: LedgerPublicationEvent): Promise<void>;
  getPublicationEvents(publicationId: string): Promise<readonly LedgerPublicationEvent[]>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryLedgerPublicationStore implements LedgerPublicationStore {
  private readonly publications = new Map<string, LedgerPublication>();
  private readonly events = new Map<string, LedgerPublicationEvent[]>();
  private current: VersionedPointer | null = null;
  private version = 0;
  failNextPointerWrite = false;

  constructor(seed?: { publications?: readonly LedgerPublication[]; current?: LedgerPublicationPointer }) {
    for (const publication of seed?.publications ?? []) {
      this.publications.set(publication.publicationId, clone(publication));
    }
    if (seed?.current) this.current = { pointer: clone(seed.current), version: "0" };
  }

  async getPublication(publicationId: string): Promise<LedgerPublication | null> {
    const publication = this.publications.get(publicationId);
    return publication ? clone(publication) : null;
  }

  async appendPublication(publication: LedgerPublication): Promise<void> {
    if (this.publications.has(publication.publicationId)) throw new Error(`Duplicate publication ID: ${publication.publicationId}`);
    this.publications.set(publication.publicationId, clone(publication));
  }

  async getCurrentPointer(): Promise<VersionedPointer | null> {
    return this.current ? clone(this.current) : null;
  }

  async writeCurrentPointer(pointer: LedgerPublicationPointer, expectedVersion: string | null): Promise<VersionedPointer> {
    if (this.failNextPointerWrite) {
      this.failNextPointerWrite = false;
      throw new Error("Injected current-pointer failure");
    }
    if ((this.current?.version ?? null) !== expectedVersion) throw new Error("Current publication pointer changed concurrently.");
    this.version += 1;
    this.current = { pointer: clone(pointer), version: String(this.version) };
    return clone(this.current);
  }

  async appendPublicationEvent(event: LedgerPublicationEvent): Promise<void> {
    const list = this.events.get(event.publicationId) ?? [];
    if (list.some((item) => item.eventId === event.eventId)) return;
    list.push(clone(event));
    this.events.set(event.publicationId, list);
  }

  async getPublicationEvents(publicationId: string): Promise<readonly LedgerPublicationEvent[]> {
    return clone(this.events.get(publicationId) ?? []);
  }
}

function safeName(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
}

export class VercelBlobLedgerPublicationStore implements LedgerPublicationStore {
  constructor(private readonly token: string) {
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is required for Ledger publication persistence.");
  }

  private async read<T>(pathname: string): Promise<{ value: T; version: string } | null> {
    const { get } = await import("@vercel/blob");
    const result = await get(pathname, { access: "private", token: this.token, useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return {
      value: JSON.parse(await new Response(result.stream).text()) as T,
      version: result.blob.etag,
    };
  }

  private async append(pathname: string, value: unknown): Promise<void> {
    const { put } = await import("@vercel/blob");
    await put(pathname, JSON.stringify(value), {
      access: "private",
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
    });
  }

  async getPublication(publicationId: string): Promise<LedgerPublication | null> {
    return (await this.read<LedgerPublication>(`ledger-automation/publications/${safeName(publicationId)}.json`))?.value ?? null;
  }

  async appendPublication(publication: LedgerPublication): Promise<void> {
    await this.append(`ledger-automation/publications/${safeName(publication.publicationId)}.json`, publication);
  }

  async getCurrentPointer(): Promise<VersionedPointer | null> {
    const result = await this.read<LedgerPublicationPointer>("ledger-automation/publications/current.json");
    return result ? { pointer: result.value, version: result.version } : null;
  }

  async writeCurrentPointer(pointer: LedgerPublicationPointer, expectedVersion: string | null): Promise<VersionedPointer> {
    const { put } = await import("@vercel/blob");
    const result = await put("ledger-automation/publications/current.json", JSON.stringify(pointer), {
      access: "private",
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: expectedVersion !== null,
      ...(expectedVersion ? { ifMatch: expectedVersion } : {}),
      contentType: "application/json",
    });
    return { pointer, version: result.etag };
  }

  async appendPublicationEvent(event: LedgerPublicationEvent): Promise<void> {
    try {
      await this.append(`ledger-automation/publication-events/${safeName(event.publicationId)}/${safeName(event.eventId)}.json`, event);
    } catch (error) {
      const existing = await this.read<LedgerPublicationEvent>(`ledger-automation/publication-events/${safeName(event.publicationId)}/${safeName(event.eventId)}.json`);
      if (!existing) throw error;
    }
  }

  async getPublicationEvents(publicationId: string): Promise<readonly LedgerPublicationEvent[]> {
    const { list } = await import("@vercel/blob");
    const prefix = `ledger-automation/publication-events/${safeName(publicationId)}/`;
    const result = await list({ prefix, token: this.token });
    const events = await Promise.all(result.blobs.map(async (blob) => (await this.read<LedgerPublicationEvent>(blob.pathname))?.value ?? null));
    return events.filter((event): event is LedgerPublicationEvent => event !== null);
  }
}

export function createProductionLedgerPublicationStore(): LedgerPublicationStore {
  return new VercelBlobLedgerPublicationStore(process.env.BLOB_READ_WRITE_TOKEN ?? "");
}
