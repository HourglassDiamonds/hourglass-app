import type {
  FounderDecisionRecord,
  LedgerAutomationRunRecord,
} from "./types";

export type AppendResult<T> = { created: boolean; value: T };

export interface LedgerAutomationStore {
  getRun(runKey: string): Promise<LedgerAutomationRunRecord | null>;
  appendRun(record: LedgerAutomationRunRecord): Promise<AppendResult<LedgerAutomationRunRecord>>;
  getDecision(decisionId: string): Promise<FounderDecisionRecord | null>;
  appendDecision(record: FounderDecisionRecord): Promise<AppendResult<FounderDecisionRecord>>;
}

export class MemoryLedgerAutomationStore implements LedgerAutomationStore {
  private readonly runs = new Map<string, LedgerAutomationRunRecord>();
  private readonly decisions = new Map<string, FounderDecisionRecord>();

  async getRun(runKey: string): Promise<LedgerAutomationRunRecord | null> {
    const record = this.runs.get(runKey);
    return record ? structuredClone(record) : null;
  }

  async appendRun(record: LedgerAutomationRunRecord): Promise<AppendResult<LedgerAutomationRunRecord>> {
    const existing = this.runs.get(record.runKey);
    if (existing) return { created: false, value: existing };
    this.runs.set(record.runKey, structuredClone(record));
    return { created: true, value: record };
  }

  async getDecision(decisionId: string): Promise<FounderDecisionRecord | null> {
    const record = this.decisions.get(decisionId);
    return record ? structuredClone(record) : null;
  }

  async appendDecision(record: FounderDecisionRecord): Promise<AppendResult<FounderDecisionRecord>> {
    const existing = this.decisions.get(record.decisionId);
    if (existing) return { created: false, value: existing };
    this.decisions.set(record.decisionId, structuredClone(record));
    return { created: true, value: record };
  }

  /** Test-only visibility; returned records remain immutable copies. */
  snapshot(): { runs: LedgerAutomationRunRecord[]; decisions: FounderDecisionRecord[] } {
    return {
      runs: structuredClone([...this.runs.values()]),
      decisions: structuredClone([...this.decisions.values()]),
    };
  }
}

function safeName(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "-");
}

export class VercelBlobLedgerAutomationStore implements LedgerAutomationStore {
  constructor(private readonly token: string) {
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is required for Ledger automation persistence.");
  }

  private runPath(runKey: string): string {
    return `ledger-automation/runs/${safeName(runKey)}.json`;
  }

  private decisionPath(decisionId: string): string {
    return `ledger-automation/decisions/${safeName(decisionId)}.json`;
  }

  private async read<T>(pathname: string): Promise<T | null> {
    const { get } = await import("@vercel/blob");
    const result = await get(pathname, { access: "private", token: this.token, useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text()) as T;
  }

  private async append<T>(pathname: string, value: T): Promise<AppendResult<T>> {
    const existing = await this.read<T>(pathname);
    if (existing) return { created: false, value: existing };
    const { put } = await import("@vercel/blob");
    try {
      await put(pathname, JSON.stringify(value), {
        access: "private",
        token: this.token,
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/json",
      });
      return { created: true, value };
    } catch (error) {
      const winner = await this.read<T>(pathname);
      if (winner) return { created: false, value: winner };
      throw error;
    }
  }

  getRun(runKey: string): Promise<LedgerAutomationRunRecord | null> {
    return this.read(this.runPath(runKey));
  }

  appendRun(record: LedgerAutomationRunRecord): Promise<AppendResult<LedgerAutomationRunRecord>> {
    return this.append(this.runPath(record.runKey), record);
  }

  getDecision(decisionId: string): Promise<FounderDecisionRecord | null> {
    return this.read(this.decisionPath(decisionId));
  }

  appendDecision(record: FounderDecisionRecord): Promise<AppendResult<FounderDecisionRecord>> {
    return this.append(this.decisionPath(record.decisionId), record);
  }
}

export function createProductionLedgerAutomationStore(): LedgerAutomationStore {
  return new VercelBlobLedgerAutomationStore(process.env.BLOB_READ_WRITE_TOKEN ?? "");
}
