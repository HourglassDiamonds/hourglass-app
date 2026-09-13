"use client";

import { useEffect, useState } from "react";
import {
  mergeEmailCardPreview,
  type CosEmailCardView,
} from "@/lib/continuum/chief-of-staff/operating-loop/email-viewer";

export function CosUnassignedIdentity({ card }: { card: CosEmailCardView }) {
  const { hydrateHref, excerpt, subject, senderEmail, senderDisplayName } = card;
  const [view, setView] = useState(card);

  useEffect(() => {
    const next: CosEmailCardView = {
      senderDisplayName,
      senderEmail,
      subject,
      excerpt,
      hydrateHref,
    };
    setView(next);
    if (!hydrateHref) return;
    let cancelled = false;
    void import("../source-viewer-actions").then(({ loadSourceViewerPreviewAction }) =>
      loadSourceViewerPreviewAction({ href: hydrateHref }),
    ).then((result) => {
      if (cancelled || !result.ok) return;
      setView((current) => mergeEmailCardPreview(current, result.preview));
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateHref, excerpt, subject, senderEmail, senderDisplayName]);

  const sender = view.senderDisplayName;
  const email = view.senderEmail;
  if (!sender && !email && !view.subject && !view.excerpt) return null;

  return (
    <div data-cos-unassigned-card="" className="mt-2 min-w-0">
      {sender ? (
        <p data-cos-sender-name="" className="break-words text-[14px] text-[#efe8de]">
          {sender}
        </p>
      ) : null}
      {email ? (
        <p
          data-cos-sender-email=""
          className={`break-words ${sender ? "mt-1 text-[13px] text-[#9a8e82]" : "text-[14px] text-[#efe8de]"}`}
        >
          {email}
        </p>
      ) : null}
      {view.subject ? (
        <p data-cos-email-subject="" className="mt-2 break-words text-[13px] text-[#c4b7aa]">
          {view.subject}
        </p>
      ) : null}
      {view.excerpt ? (
        <p data-cos-email-excerpt="" className="mt-2 break-words text-[14px] leading-relaxed text-[#c4b7aa]">
          {view.excerpt}
        </p>
      ) : null}
    </div>
  );
}
