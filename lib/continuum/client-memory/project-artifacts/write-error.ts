/**
 * Distinguishes storage-object failure from canonical-row failure.
 * Callers must not leave a row without an object, or an object without a row.
 */

export class ProjectArtifactWriteError extends Error {
  readonly phase: "storage" | "db";
  readonly storagePath: string | null;

  constructor(
    phase: "storage" | "db",
    message: string,
    storagePath: string | null = null,
  ) {
    super(message);
    this.name = "ProjectArtifactWriteError";
    this.phase = phase;
    this.storagePath = storagePath;
  }
}

export function isProjectArtifactWriteError(
  error: unknown,
): error is ProjectArtifactWriteError {
  return error instanceof ProjectArtifactWriteError;
}
