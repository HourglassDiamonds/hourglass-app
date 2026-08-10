import Link from "next/link";
import { PERSON_JOB_TITLE, PERSON_NAME } from "@/lib/seo/schema/constants";

export default function ArticleAuthorByline() {
  return (
    <div className="mt-5 text-center">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
        By{" "}
        {/* P0-4 (WCAG 1.4.1): underline gives the link a non-color
            distinction from the surrounding byline text. */}
        <Link
          href="/the-house"
          className="text-[#6d655e] underline decoration-[#c9bfb2] underline-offset-4 transition-colors duration-300 hover:text-[#1f1d1a] hover:decoration-[#1f1d1a]"
        >
          {PERSON_NAME}
        </Link>
        , {PERSON_JOB_TITLE} · Hourglass Diamonds
      </p>
    </div>
  );
}
