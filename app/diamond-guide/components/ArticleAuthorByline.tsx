import Link from "next/link";
import { PERSON_JOB_TITLE, PERSON_NAME } from "@/lib/seo/schema/constants";

export default function ArticleAuthorByline() {
  return (
    <div className="mt-5 text-center">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#9a9084]">
        By{" "}
        <Link
          href="/the-house"
          className="text-[#7a726a] transition-colors duration-300 hover:text-[#1f1d1a]"
        >
          {PERSON_NAME}
        </Link>
        , {PERSON_JOB_TITLE} · Hourglass Diamonds
      </p>
    </div>
  );
}
