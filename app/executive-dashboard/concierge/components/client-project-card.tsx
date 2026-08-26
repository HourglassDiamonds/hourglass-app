import {
  conciergeProjectPath,
  historyFields,
} from "@/lib/continuum/client-memory/read/presentation";
import type { LinkedProjectRead } from "@/lib/continuum/client-memory/read/types";
import Link from "next/link";

export function ClientProjectCard({ project }: { project: LinkedProjectRead }) {
  const details = historyFields(project);
  return (
    <article className="rounded-[20px] border border-white/[0.07] bg-[#1c1815] px-4 py-4">
      <h3 className="font-serif text-[1.22rem] leading-[1.2] tracking-[-0.02em]">
        <Link
          href={conciergeProjectPath(project.profile.projectId)}
          className="text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164]"
        >
          {project.profile.displayTitle}
        </Link>
      </h3>
      {details.length > 0 ? (
        <details className="group mt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-[12px] uppercase tracking-[0.2em] text-[#ad9164] outline-none focus-visible:text-[#efe8de]">
            <span className="group-open:hidden">Details</span>
            <span className="hidden group-open:inline">Close</span>
          </summary>
          <dl className="mt-3 space-y-2.5">
            {details.map((row) => (
              <div key={row.label}>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
                  {row.label}
                </dt>
                <dd className="mt-1 break-words text-[14.5px] leading-relaxed text-[#e7ddd2]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </article>
  );
}
