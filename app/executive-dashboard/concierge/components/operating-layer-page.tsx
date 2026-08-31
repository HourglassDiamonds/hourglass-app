import Link from "next/link";
import {
  conciergeCorrectOperatingDetailPath,
  conciergeProjectPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { projectKindLabel, type ProjectKind } from "@/lib/continuum/client-memory/project-kind";
import { OPERATING_DETAIL_NOT_SET } from "@/lib/continuum/client-memory/project-operating/fields";
import type { ProjectOperatingLayer } from "@/lib/continuum/client-memory/project-operating/layer";

export function OperatingLayerWrongKindNotice({
  projectId,
  projectTitle,
  expected,
  currentKind,
}: {
  projectId: string;
  projectTitle: string;
  expected: "custom_new_jewelry" | "repair_service";
  currentKind: ProjectKind | null;
}) {
  const expectedLabel =
    expected === "custom_new_jewelry"
      ? "Custom / New Jewelry"
      : "Repair / Service";
  const current =
    currentKind == null
      ? "currently unclassified"
      : `currently classified as ${projectKindLabel(currentKind)}`;
  return (
    <div className="hg-concierge-fade mt-8">
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
        {expectedLabel}
      </h1>
      <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#c4b7aa]">
        This Project is {current}. The {expectedLabel} operating layer is not
        active.
      </p>
      <p className="mt-6">
        <Link
          href={conciergeProjectPath(projectId)}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          ← {projectTitle}
        </Link>
      </p>
    </div>
  );
}

export function OperatingLayerOverview({
  projectId,
  projectTitle,
  layer,
}: {
  projectId: string;
  projectTitle: string;
  layer: Extract<
    ProjectOperatingLayer,
    { kind: "custom_new_jewelry" | "repair_service" }
  >;
}) {
  return (
    <div className="hg-concierge-fade mt-8">
      <h1 className="font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
        {layer.title}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
        {projectTitle}
      </p>
      <dl className="mt-8 space-y-4">
        {layer.fields.map((row) => (
          <div key={row.fieldName}>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              {row.label}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#e7ddd2]">
              {row.value?.trim() ? row.value : OPERATING_DETAIL_NOT_SET}
            </dd>
            <dd>
              <Link
                href={conciergeCorrectOperatingDetailPath(
                  projectId,
                  row.fieldName,
                )}
                className="mt-1 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
              >
                {row.value?.trim() ? "Correct" : "Set"}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
