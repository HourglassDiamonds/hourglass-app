"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  PRODUCTION_SHADOW_PASSKEY_BEGIN_ROUTE,
  PRODUCTION_SHADOW_PASSKEY_COMPLETE_ROUTE,
  PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH,
} from "@/lib/continuum/production-staging-access";

const ERROR = "Unable to verify the founder passkey. Try again.";

export function ShadowPasskeyLoginButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    setPending(true);
    setError(null);
    try {
      const beginResponse = await fetch(PRODUCTION_SHADOW_PASSKEY_BEGIN_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const begin = await beginResponse.json() as
        | { ok: true; options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }
        | { ok: false };
      if (!beginResponse.ok || !begin.ok) throw new Error("begin-failed");

      const assertion = await startAuthentication({ optionsJSON: begin.options });
      const completeResponse = await fetch(PRODUCTION_SHADOW_PASSKEY_COMPLETE_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const complete = await completeResponse.json() as
        | { ok: true; redirect: string }
        | { ok: false };
      if (!completeResponse.ok || !complete.ok) throw new Error("complete-failed");
      window.location.assign(
        complete.redirect || PRODUCTION_STAGING_OPERATIONAL_SHADOW_PATH,
      );
    } catch {
      setError(ERROR);
      setPending(false);
    }
  }

  return (
    <div className="mt-10 space-y-4">
      <button
        type="button"
        onClick={() => void onContinue()}
        disabled={pending}
        className="min-h-12 w-full rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] disabled:opacity-60"
      >
        {pending ? "Continuing…" : "Continue with founder passkey"}
      </button>
      <p className="text-[13px] leading-relaxed text-[#8d8073]">
        Uses your existing verified founder identity. No temporary password is required.
      </p>
      {error ? <p role="alert" className="text-[13px] text-[#d2b8a8]">{error}</p> : null}
    </div>
  );
}
