import type { WebsiteInquiry, WebsiteIntakeResult, WebsiteIntakeStore } from "./types";
import { buildWebsiteIntakeCommand } from "./validation";

export async function ingestWebsiteInquiry(
  store: WebsiteIntakeStore,
  inquiry: WebsiteInquiry,
): Promise<WebsiteIntakeResult> {
  try {
    return await store.ingest(buildWebsiteIntakeCommand(inquiry));
  } catch (error) {
    if (error instanceof Error && error.message.includes("idempotency-conflict")) {
      return { ok: false, reason: "idempotency-conflict" };
    }
    return { ok: false, reason: "unavailable" };
  }
}
