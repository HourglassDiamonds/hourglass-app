import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getAuthenticatedProjectDeskReader } from "@/lib/continuum/client-memory/project-desk/load";
import { getAuthenticatedGmailArtifactCopy } from "@/lib/continuum/client-memory/project-artifact-gmail-copy/load";
import { presentGmailCopyPreview } from "@/lib/continuum/client-memory/project-artifact-gmail-copy/preview";
import {
  conciergeProjectPath,
  isProjectIdParam,
} from "@/lib/continuum/client-memory/read/presentation";
import { ConciergeShell } from "../../../../components/concierge-shell";
import { ConciergeUnavailable } from "../../../../components/client-profile-view";
import { CopyGmailAttachmentToProjectForm } from "../../../../components/copy-gmail-attachment-to-project-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Copy Gmail file to project",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function ConciergeCopyGmailProjectArtifactPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ messageId?: string; attachmentId?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  if (!isProjectIdParam(projectId)) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  const [deskAuth, copyAuth] = await Promise.all([
    getAuthenticatedProjectDeskReader(),
    getAuthenticatedGmailArtifactCopy(),
  ]);
  if (!deskAuth.ok || !copyAuth.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  let desk: Awaited<ReturnType<typeof deskAuth.reader.getProjectDesk>>;
  try {
    desk = await deskAuth.reader.getProjectDesk(projectId);
  } catch {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This surface could not be opened right now."
        />
      </ConciergeShell>
    );
  }

  if (!desk.ok) {
    return (
      <ConciergeShell>
        <ConciergeUnavailable
          title="Project unavailable."
          body="This project could not be found."
        />
      </ConciergeShell>
    );
  }

  if (!desk.desk.artifacts.connected) {
    return (
      <ConciergeShell>
        <Link
          href={conciergeProjectPath(projectId)}
          aria-label={`Back to ${desk.desk.title}`}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          ← {desk.desk.title}
        </Link>
        <div className="hg-concierge-fade mt-8">
          <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
            Copy Gmail file to project
          </h1>
          <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
            Project files are not connected yet.
          </p>
        </div>
      </ConciergeShell>
    );
  }

  const messageId = String(query.messageId ?? "").trim();
  const attachmentId = String(query.attachmentId ?? "").trim();
  if (!messageId || !attachmentId) {
    return (
      <ConciergeShell>
        <Link
          href={conciergeProjectPath(projectId)}
          aria-label={`Back to ${desk.desk.title}`}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          ← {desk.desk.title}
        </Link>
        <div className="hg-concierge-fade mt-8">
          <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
            Copy Gmail file to project
          </h1>
          <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
            Choose a Gmail attachment from project evidence first. Copy-in is
            founder-approved only.
          </p>
        </div>
      </ConciergeShell>
    );
  }

  const [indexedMessage, indexedRows] = await Promise.all([
    copyAuth.index.getMessage(messageId),
    copyAuth.attachments.listByMessage(messageId),
  ]);
  const preview = presentGmailCopyPreview({
    messageId,
    attachmentId,
    indexedMessage,
    indexedAttachment:
      indexedRows.find((row) => row.attachmentId === attachmentId) ?? null,
  });

  return (
    <ConciergeShell>
      <Link
        href={conciergeProjectPath(projectId)}
        aria-label={`Back to ${desk.desk.title}`}
        className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        ← {desk.desk.title}
      </Link>
      <div className="hg-concierge-fade mt-8">
        <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Copy Gmail file to project
        </h1>
        <div className="mt-8">
          {preview.ok ? (
            <CopyGmailAttachmentToProjectForm
              projectId={projectId}
              projectTitle={desk.desk.title}
              mutationId={randomUUID()}
              preview={preview}
            />
          ) : (
            <p className="max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
              That Gmail attachment is not in the indexed evidence.
            </p>
          )}
        </div>
      </div>
    </ConciergeShell>
  );
}
