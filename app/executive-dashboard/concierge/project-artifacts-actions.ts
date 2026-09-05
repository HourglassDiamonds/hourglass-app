"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedProjectArtifactWriter } from "@/lib/continuum/client-memory/project-artifacts/load-writer";
import type { CreateProjectArtifactResult } from "@/lib/continuum/client-memory/project-artifacts/create";
import { conciergeProjectPath } from "@/lib/continuum/client-memory/read/presentation";

export type SaveProjectArtifactState = { ok: false; message: string } | null;

function mimeFromUpload(file: File): string {
  const typed = file.type.trim().toLowerCase();
  if (typed) return typed;
  const name = file.name.trim().toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  if (name.endsWith(".pdf")) return "application/pdf";
  return "";
}

function humanCreateMessage(result: CreateProjectArtifactResult): string {
  if (result.ok) return "Unable to save the project file.";
  if (result.code === "invalid-kind") return "Choose a valid file type.";
  if (result.code === "invalid-title") return "Add a short title.";
  if (result.code === "invalid-filename" || result.code === "invalid-mime") {
    return "Choose a JPEG, PNG, WebP, HEIC, or PDF file.";
  }
  if (result.code === "invalid-bytes") {
    return "Choose a file under 25 MB.";
  }
  if (
    result.reason === "entity-kind-mismatch" ||
    result.reason === "project-not-found"
  ) {
    return "That project could not be found.";
  }
  return "Unable to save the project file.";
}

export async function saveProjectArtifact(
  _prev: SaveProjectArtifactState,
  formData: FormData,
): Promise<SaveProjectArtifactState> {
  const auth = await getAuthenticatedProjectArtifactWriter();
  if (!auth.ok) {
    return {
      ok: false,
      message:
        auth.reason === "unauthorized"
          ? "Sign in to continue."
          : "Unable to save the project file.",
    };
  }
  const projectId = String(formData.get("projectId") ?? "").trim();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return { ok: false, message: "Choose a file to store." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await auth.writer.createArtifact({
    mutationId: String(formData.get("mutationId") ?? "").trim(),
    projectId,
    kind: String(formData.get("kind") ?? "").trim(),
    title: String(formData.get("title") ?? ""),
    originalFilename: file.name,
    mimeType: mimeFromUpload(file),
    bytes,
    actor: auth.username,
  });
  if (result.ok) {
    redirect(`${conciergeProjectPath(projectId)}?saved=file`);
  }
  return { ok: false, message: humanCreateMessage(result) };
}
