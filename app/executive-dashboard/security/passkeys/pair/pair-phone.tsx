"use client";

import { useEffect, useRef, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  formatMatchCode,
  readPairingTokenFromHash,
} from "@/lib/executive-dashboard/passkeys/pairing-format";
import type { PasskeyPairingPublicView } from "@/lib/executive-dashboard/passkeys/types";
import {
  beginIphonePairingRegistrationAction,
  claimIphonePairingFromTokenAction,
  completeIphonePairingRegistrationAction,
  readPhonePairingAction,
} from "./actions";

const ENROLL_ERROR = "Unable to create passkey. Try again.";
const PAIR_ERROR = "This setup session has expired or was cancelled.";

export function PairPhone({
  initial,
}: {
  initial: { ok: true; pairing: PasskeyPairingPublicView } | { ok: false };
}) {
  const [pairing, setPairing] = useState<PasskeyPairingPublicView | null>(
    initial.ok ? initial.pairing : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [claiming, setClaiming] = useState(!initial.ok);
  const started = useRef(false);
  const claimed = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (typeof window === "undefined" || claimed.current) return;
    claimed.current = true;
    const token = readPairingTokenFromHash(window.location.hash);
    window.history.replaceState(null, "", window.location.pathname);

    if (!token) {
      setClaiming(false);
      if (!initial.ok) setError(PAIR_ERROR);
      return;
    }

    void claimIphonePairingFromTokenAction(token).then((result) => {
      setClaiming(false);
      if (result.ok) {
        setPairing(result.pairing);
        setError(null);
        return;
      }
      if (initial.ok) return;
      setPairing(null);
      setError(PAIR_ERROR);
    });
  }, [initial.ok]);

  useEffect(() => {
    if (!pairing) return;
    if (
      pairing.status === "completed" ||
      pairing.status === "cancelled" ||
      pairing.status === "expired"
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void readPhonePairingAction().then((result) => {
        if (!result.ok) {
          setPairing(null);
          setError(PAIR_ERROR);
          return;
        }
        setPairing(result.pairing);
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  useEffect(() => {
    if (!pairing || pairing.status !== "approved" || started.current || pending) {
      return;
    }
    started.current = true;
    void enroll();
  }, [pairing, pending]);

  async function enroll() {
    setPending(true);
    setError(null);
    try {
      const begin = await beginIphonePairingRegistrationAction();
      if (!begin.ok) {
        setError(begin.error);
        started.current = false;
        return;
      }
      const attestation = await startRegistration({
        optionsJSON: begin.options,
      });
      const done = await completeIphonePairingRegistrationAction(attestation);
      if (done && !done.ok) {
        setError(done.error);
        started.current = false;
      }
    } catch {
      setError(ENROLL_ERROR);
      started.current = false;
    } finally {
      setPending(false);
    }
  }

  if (claiming && !pairing) {
    return (
      <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#14110f] text-[#efe8de]">
        <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            Continuum
          </p>
          <h1 className="mt-3 font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
            Set up this device?
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
            Connecting this iPhone…
          </p>
        </div>
      </main>
    );
  }

  if (!pairing) {
    return (
      <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#14110f] text-[#efe8de]">
        <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
            Continuum
          </p>
          <h1 className="mt-3 font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
            Set up this device?
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
            This setup session has expired or was cancelled.
          </p>
          {error ? (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="mt-6 text-[13px] leading-relaxed text-[#d2b8a8] outline-none"
            >
              {error}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  const waiting = pairing.status === "pending" || pairing.status === "claimed";
  const approved = pairing.status === "approved";

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#14110f] text-[#efe8de]">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          Continuum
        </p>
        <h1 className="mt-3 font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          Set up this device?
        </h1>
        {waiting ? (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
              Waiting for approval from your signed-in Continuum session.
            </p>
            {pairing.deviceHint ? (
              <p className="mt-3 text-[13px] text-[#8d8073]">{pairing.deviceHint}</p>
            ) : null}
            <p className="mt-8 text-center font-serif text-[1.65rem] tracking-[0.18em] text-[#efe8de]">
              {formatMatchCode(pairing.matchCode)}
            </p>
          </>
        ) : null}
        {approved ? (
          <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
            {pending
              ? "Use Face ID to create this iPhone passkey."
              : "Approved. Continue with Face ID."}
          </p>
        ) : null}
        {error ? (
          <>
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="mt-6 text-[13px] leading-relaxed text-[#d2b8a8] outline-none"
            >
              {error}
            </p>
            {approved ? (
              <button
                type="button"
                onClick={() => {
                  started.current = false;
                  void enroll();
                }}
                disabled={pending}
                className="mt-6 min-h-12 w-full rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] disabled:opacity-60"
              >
                Try again
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
