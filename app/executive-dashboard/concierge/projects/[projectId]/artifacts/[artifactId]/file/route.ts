import { NextResponse } from "next/server";
import { getAuthenticatedProjectArtifactWriter } from "@/lib/continuum/client-memory/project-artifacts/load-writer";
import { isProjectIdParam } from "@/lib/continuum/client-memory/read/presentation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function fail(status: number) {
  return NextResponse.json({ ok: false }, { status, headers: NO_STORE_HEADERS });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; artifactId: string }> },
) {
  const { projectId, artifactId } = await context.params;
  if (!isProjectIdParam(projectId) || !isProjectIdParam(artifactId)) {
    return fail(404);
  }

  const auth = await getAuthenticatedProjectArtifactWriter();
  if (!auth.ok) {
    return fail(auth.reason === "unauthorized" ? 401 : 404);
  }

  const packed = await auth.writer.getArtifactBytes(projectId, artifactId);
  if (!packed) return fail(404);

  return new NextResponse(Buffer.from(packed.bytes), {
    status: 200,
    headers: {
      ...NO_STORE_HEADERS,
      "Content-Type": packed.artifact.mimeType,
      "Content-Disposition": `inline; filename="${packed.artifact.originalFilename.replace(/"/g, "")}"`,
      "Content-Length": String(packed.bytes.byteLength),
    },
  });
}
