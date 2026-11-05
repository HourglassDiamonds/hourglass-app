import type { AcceptIntakeResult, AcknowledgementOutboxItem, ConciergeFunnelRecord, ConciergeFunnelStore } from "./types";
import { conciergeAcceptancePayloadHash } from "./persistence-contract";

/** Deterministic Preview acceptance store. Production adapters require separate infrastructure authorization. */
export class InMemoryConciergeFunnelStore implements ConciergeFunnelStore {
  private readonly bySubmission = new Map<string, ConciergeFunnelRecord>();

  async accept(record: ConciergeFunnelRecord): Promise<AcceptIntakeResult> {
    const existing = this.bySubmission.get(record.intake.submissionId);
    if (existing) {
      if (
        conciergeAcceptancePayloadHash(existing) !==
        conciergeAcceptancePayloadHash(record)
      ) {
        return { status: "idempotency_conflict" };
      }
      return { status: "duplicate", record: existing };
    }
    this.bySubmission.set(record.intake.submissionId, structuredClone(record));
    return { status: "created", record: structuredClone(record) };
  }

  async getBySubmissionId(submissionId: string): Promise<ConciergeFunnelRecord | null> {
    const record = this.bySubmission.get(submissionId);
    return record ? structuredClone(record) : null;
  }

  async updateAcknowledgement(item: AcknowledgementOutboxItem): Promise<void> {
    for (const [key, record] of this.bySubmission) {
      if (record.acknowledgement.outboxId === item.outboxId) {
        this.bySubmission.set(key, { ...record, acknowledgement: structuredClone(item) });
        return;
      }
    }
    throw new Error("acknowledgement-not-found");
  }

  snapshot(): ConciergeFunnelRecord[] {
    return [...this.bySubmission.values()].map((item) => structuredClone(item));
  }
}
