import Link from "next/link";
import {
  ASK_ERROR_MESSAGE,
  ASK_UNSUPPORTED_DETAIL,
  ASK_UNSUPPORTED_MESSAGE,
  askBirthdaysByMonthHeadline,
  formatAskBirthdayDate,
  type AskConciergeAnswer,
} from "@/lib/continuum/client-memory/ask/types";
import { conciergeClientPath } from "@/lib/continuum/client-memory/read/presentation";

export function AskConciergeAnswerView({ answer }: { answer: AskConciergeAnswer }) {
  if (answer.kind === "error") {
    return (
      <p className="mt-4 text-[14px] leading-relaxed text-[#c4b7aa]" role="status">
        {ASK_ERROR_MESSAGE}
      </p>
    );
  }

  if (answer.kind === "unsupported") {
    return (
      <div className="mt-4" role="status">
        <p className="text-[14px] leading-relaxed text-[#c4b7aa]">{ASK_UNSUPPORTED_MESSAGE}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-[#7d7268]">
          {ASK_UNSUPPORTED_DETAIL}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-[14px] leading-relaxed text-[#c4b7aa]" role="status">
        {askBirthdaysByMonthHeadline(answer.month, answer.people.length)}
      </p>
      {answer.people.length > 0 ? (
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {answer.people.map((person) => (
            <li key={person.factId}>
              <Link
                href={conciergeClientPath(person.personId)}
                className="block min-h-14 rounded-[18px] px-1 py-4 outline-none transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:shadow-[0_0_0_2px_#987648]"
              >
                <p className="font-serif text-[1.28rem] leading-[1.15] tracking-[-0.03em] text-[#efe8de]">
                  {person.displayName}
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#b7aa9c]">
                  {formatAskBirthdayDate(person)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
