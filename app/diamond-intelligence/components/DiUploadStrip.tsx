"use client";

import type { ClientSafeMetadata } from "@/lib/diamond-intelligence/client-api";
import {
  ReportUploadDock,
  type ClientUploadPhase,
} from "./ReportUploadDock";
import { DI_BODY_MUTED, DI_EYEBROW } from "./di-editorial-classes";

export default function DiUploadStrip({
  phase,
  disabled,
  errorMessage,
  statusNote,
  onFile,
  onClearError,
  metadata,
  fileName,
  hasReport,
}: {
  phase: ClientUploadPhase;
  disabled: boolean;
  errorMessage: string | null;
  statusNote?: string | null;
  onFile: (file: File) => void;
  onClearError?: () => void;
  metadata: ClientSafeMetadata | null;
  fileName: string | null;
  hasReport: boolean;
}) {
  return (
    <section className="border-b border-[#e4dbcf]/45 pb-8 pt-2 md:pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-10">
        <div className="max-w-md shrink-0">
          <p className={DI_EYEBROW}>Your Report</p>
          <p className={`${DI_BODY_MUTED} mt-2 text-[0.9rem]`}>
            {hasReport
              ? "Upload a different report to start a new read."
              : "Upload a GIA, IGI, or GCAL grading report PDF to begin."}
          </p>
        </div>
        <div className="min-w-0 flex-1 md:max-w-xl">
          <ReportUploadDock
            phase={phase}
            disabled={disabled}
            errorMessage={errorMessage}
            statusNote={statusNote}
            onFile={onFile}
            onClearError={onClearError}
            metadata={hasReport ? metadata : null}
            fileName={fileName}
          />
        </div>
      </div>
    </section>
  );
}
