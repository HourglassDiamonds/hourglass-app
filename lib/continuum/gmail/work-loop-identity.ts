/**
 * Re-export Today work-loop identity helpers.
 * Implementation lives in candidates so founder-attention stays free of Gmail ingest.
 */
export {
  canonicalWorkLoopId,
  clientLabelFromIdentityHay,
  currentCadTokensFromIdentityHay,
  parseHgdClientLabel,
  parseShopCadFilename,
  type WorkLoopClientLabel,
} from "@/lib/continuum/candidates/work-loop-identity";
