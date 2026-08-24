import Link from "next/link";
import { conciergeAddNotePickerPath } from "@/lib/continuum/client-memory/read/presentation";

export function QuickCapture() {
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
        Quick Capture
      </h2>
      <Link
        href={conciergeAddNotePickerPath()}
        className="mt-4 inline-flex min-h-12 items-center text-[11px] uppercase tracking-[0.24em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
      >
        Add Note
      </Link>
    </section>
  );
}
