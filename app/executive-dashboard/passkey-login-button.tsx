"use client";

import { useEffect, useRef, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  beginPasskeyAuthentication,
  completePasskeyAuthentication,
} from "./passkey-actions";

const PASSKEY_AUTH_ERROR =
  "Unable to verify passkey. Try again or use your password.";

export function PasskeyLoginButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onContinue() {
    setPending(true);
    setError(null);
    try {
      const begin = await beginPasskeyAuthentication();
      if (!begin.ok) {
        setError(begin.error);
        return;
      }
      const assertion = await startAuthentication({
        optionsJSON: begin.options,
      });
      const done = await completePasskeyAuthentication(assertion);
      if (done && !done.ok) {
        setError(done.error);
      }
    } catch {
      setError(PASSKEY_AUTH_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => void onContinue()}
        disabled={pending}
        className="min-h-12 w-full rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none transition-opacity hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-60"
      >
        {pending ? "Continuing…" : "Continue with passkey"}
      </button>
      <p className="text-[13px] leading-relaxed text-[#8d8073]">
        Uses Face ID on iPhone.
      </p>
      {error ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="text-[13px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
