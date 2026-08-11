import {
  BUSINESS_ADDRESS_LOCALITY,
  BUSINESS_ADDRESS_REGION,
  BUSINESS_OFFICE_HOURS_LABEL,
  BUSINESS_POSTAL_CODE,
  BUSINESS_TELEPHONE_DISPLAY,
  BUSINESS_TELEPHONE_E164,
  businessStreetAddressLine,
} from "@/lib/seo/schema/constants";

/**
 * Quiet Charlotte office identity for Concierge.
 * Office is staffed during published hours; consultations remain by appointment.
 */
export default function ConciergeOfficeInfo() {
  return (
    <div className="mt-8 max-w-[32rem] border-t border-[#e4dbcf]/90 pt-6 lg:max-w-[28rem]">
      <p className="text-[10px] uppercase tracking-[0.32em] text-[#6d655e]">
        Charlotte Office
      </p>
      <address className="mt-3 not-italic text-[0.92rem] leading-[1.75] text-[#6a635c]">
        <span className="block">{businessStreetAddressLine()}</span>
        <span className="block">
          {BUSINESS_ADDRESS_LOCALITY}, {BUSINESS_ADDRESS_REGION}{" "}
          {BUSINESS_POSTAL_CODE}
        </span>
        <a
          href={`tel:${BUSINESS_TELEPHONE_E164}`}
          className="hg-tap mt-1 inline-flex min-h-11 items-center text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]"
        >
          {BUSINESS_TELEPHONE_DISPLAY}
        </a>
      </address>
      <p className="mt-3 text-[0.88rem] leading-[1.75] text-[#6d655e]">
        Office hours {BUSINESS_OFFICE_HOURS_LABEL}. Private consultations by
        appointment.
      </p>
    </div>
  );
}
