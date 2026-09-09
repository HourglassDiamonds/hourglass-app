/**
 * App Router entry for the repair-quote founder writer.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

export {
  createSupabaseRepairQuoteWriter,
  SupabaseRepairQuoteWriter,
} from "./supabase-writer";
