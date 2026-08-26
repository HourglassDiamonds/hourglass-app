import Link from "next/link";
import {
  conciergeAddClientPath,
  conciergeAddNotePickerPath,
  conciergeInboxPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { conciergeMyCardPath } from "@/lib/continuum/digital-card/paths";

export function QuickCapture() {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        Quick Capture
      </h2>
      <div className="mt-4 flex flex-col items-start gap-3">
        <Link
          href={conciergeInboxPath()}
          className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Inbox
        </Link>
        <Link
          href={conciergeAddNotePickerPath()}
          className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Add Note
        </Link>
        <Link
          href={conciergeAddClientPath()}
          className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          Add Client
        </Link>
        <Link
          href={conciergeMyCardPath()}
          className="inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        >
          My Card
        </Link>
      </div>
    </section>
  );
}
