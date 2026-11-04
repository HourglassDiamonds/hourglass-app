import type { AcknowledgementTransport } from "./kernel";

export class FakeAcknowledgementTransport implements AcknowledgementTransport {
  readonly mode = "preview-fake" as const;
  readonly sent: string[] = [];

  constructor(private readonly outcome: "confirmed" | "unknown" | "failed" = "confirmed") {}

  async send(item: Parameters<AcknowledgementTransport["send"]>[0]): ReturnType<AcknowledgementTransport["send"]> {
    this.sent.push(item.idempotencyKey);
    if (this.outcome === "confirmed") return { status: "confirmed", providerMessageId: `fake-${item.outboxId}` };
    return { status: this.outcome };
  }
}
