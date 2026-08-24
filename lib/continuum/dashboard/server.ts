/**
 * App Router entry for the Continuum command-center home model.
 * Importing this file from a Client Component fails the build.
 */

import "server-only";

import { composeContinuumHome } from "./compose";
import type { ContinuumHomeModel } from "./types";

export function loadContinuumHomeModel(now = new Date()): ContinuumHomeModel {
  return composeContinuumHome({ now });
}
