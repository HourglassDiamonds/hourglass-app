import type { CaptureRequest, CaptureProposal, CaptureCommitInput, CaptureCommitResult } from "./types";
import { isCaptureRequest, isCaptureProposal, isCaptureCommitInput, isCaptureCommitResult } from "./validate";

/** Application boundary; production dependencies are exclusively server-side. */
export function captureApplication(deps: {
  authenticate(): Promise<void>;
  interpret(request: CaptureRequest): Promise<CaptureProposal>;
  commit(input: CaptureCommitInput): Promise<CaptureCommitResult>;
}) {
  return {
    async proposeAction(request: CaptureRequest): Promise<CaptureProposal> {
      await deps.authenticate();
      if (!isCaptureRequest(request)) throw new Error("Invalid capture request");
      const proposal = await deps.interpret(request);
      if (!isCaptureProposal(proposal) || proposal.captureId !== request.captureId) throw new Error("Invalid capture proposal");
      return proposal;
    },
    async saveAction(input: CaptureCommitInput): Promise<CaptureCommitResult> {
      await deps.authenticate();
      if (!isCaptureCommitInput(input)) throw new Error("Invalid capture confirmation");
      const result = await deps.commit(input);
      const selected = new Set(input.items.filter(item => item.selected).map(item => item.itemId));
      if (!isCaptureCommitResult(result) || result.captureId !== input.captureId
        || result.items.length !== selected.size || result.items.some(item => !selected.has(item.itemId))) {
        throw new Error("Incomplete capture result");
      }
      return result;
    },
  };
}
