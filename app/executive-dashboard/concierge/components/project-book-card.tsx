import Link from "next/link";
import {
  conciergeProjectPath,
  formatNoteDate,
} from "@/lib/continuum/client-memory/read/presentation";
import { coverageLine } from "@/lib/continuum/client-memory/project-desk/presentation";
import type { ProjectDeskSummary } from "@/lib/continuum/client-memory/project-desk/types";

export function ProjectBookCard({ project }: { project: ProjectDeskSummary }) {
  const people =
    project.people.length === 0
      ? null
      : project.people.map((row) => row.displayName).join(" · ");
  const noteDate = project.latestNoteAt ? formatNoteDate(project.latestNoteAt) : null;

  return (
    <article className="rounded-[20px] border border-white/[0.07] bg-[#1c1815] px-4 py-4">
      <h2 className="font-serif text-[1.28rem] leading-[1.2] tracking-[-0.02em]">
        <Link
          href={conciergeProjectPath(project.projectId)}
          className="text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
        >
          {project.title}
        </Link>
      </h2>
      {people ? (
        <p className="mt-2 text-[14.5px] leading-relaxed text-[#c4b7aa]">{people}</p>
      ) : null}
      {project.latestNotePreview ? (
        <p className="mt-2 text-[14px] leading-relaxed text-[#9a8e82]">
          {noteDate ? `${noteDate} · ` : null}
          {project.latestNotePreview}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
        {coverageLine(project.coverage)}
      </p>
    </article>
  );
}
