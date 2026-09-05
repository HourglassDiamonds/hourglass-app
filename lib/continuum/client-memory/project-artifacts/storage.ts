/**
 * Server-generated private object paths. Never a public URL.
 */

import { PROJECT_ARTIFACTS_BUCKET } from "./types";
import {
  artifactExtensionForMime,
  isProjectArtifactUuid,
} from "./validate";

export const PROJECT_ARTIFACTS_SIGNED_URL_TTL_SECONDS = 60;

export function projectArtifactObjectPath(
  projectId: string,
  artifactId: string,
  mimeType: string,
): string | null {
  if (!isProjectArtifactUuid(projectId) || !isProjectArtifactUuid(artifactId)) {
    return null;
  }
  const ext = artifactExtensionForMime(mimeType);
  if (!ext) return null;
  return `${projectId.trim()}/${artifactId.trim()}/file.${ext}`;
}

export function isProjectArtifactsBucket(name: string): boolean {
  return name.trim() === PROJECT_ARTIFACTS_BUCKET;
}
