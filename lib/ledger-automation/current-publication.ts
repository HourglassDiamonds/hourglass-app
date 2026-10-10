import { cache } from "react";
import { OCTOBER_10_LEDGER_PUBLICATION } from "./baseline-publication";
import { createProductionLedgerPublicationStore } from "./publication-store";
import { getCurrentLedgerPublicationFromStore } from "./publication-writer";

/** One request-scoped read guarantees every component renders one pointer value. */
export const getCurrentLedgerPublication = cache(async () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return structuredClone(OCTOBER_10_LEDGER_PUBLICATION);
  try {
    return await getCurrentLedgerPublicationFromStore(createProductionLedgerPublicationStore());
  } catch (error) {
    console.error("ledger-publication read failed closed; using frozen accepted baseline", error instanceof Error ? error.message : "unknown error");
    return structuredClone(OCTOBER_10_LEDGER_PUBLICATION);
  }
});
