"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const INPUT_CLASS =
  "min-w-0 flex-1 rounded-sm border border-[#d8cfc3] bg-[#faf7f2]/80 px-4 py-3 text-[0.9rem] text-[#1f1d1a] placeholder:text-[#a39a90] focus:border-[#b8a690] focus:outline-none focus:ring-1 focus:ring-[#b8a690]/40 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[15rem]";

const BUTTON_CLASS =
  "shrink-0 rounded-sm border border-[#3a3632] bg-[#2f2b27] px-6 py-[10px] text-[10px] uppercase tracking-[0.28em] text-[#faf7f2] transition-colors hover:bg-[#1f1d1a] disabled:cursor-not-allowed disabled:opacity-60";

export default function LedgerSignup() {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const submittingRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    console.log("[ledger-signup] mounted", { pathname });
  }, [pathname]);

  const isDisabled =
    status === "submitting" || status === "success" || completedRef.current;

  async function submitSignup(trimmedEmail: string) {
    if (submittingRef.current || completedRef.current) {
      console.log("[ledger-signup] submit skipped — already submitting or done");
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");

    const subscriptionPage = pathname || "/ledger";

    try {
      console.log("[ledger-signup] fetch /api/ledger-signup", {
        subscriptionPage,
      });

      const response = await fetch("/api/ledger-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          subscriptionPage,
        }),
      });

      console.log("[ledger-signup] response status", response.status);

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        console.log("[ledger-signup] error message", data.error ?? response.statusText);
        setStatus("error");
        submittingRef.current = false;
        return;
      }

      completedRef.current = true;
      setStatus("success");
    } catch (error) {
      console.log(
        "[ledger-signup] error message",
        error instanceof Error ? error.message : String(error)
      );
      setStatus("error");
      submittingRef.current = false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.log("submit fired");

    if (isDisabled) {
      console.log("[ledger-signup] submit blocked — disabled state");
      return;
    }

    const trimmed = email.trim();

    if (!trimmed) {
      console.log("[ledger-signup] submit blocked — empty email");
      return;
    }

    await submitSignup(trimmed);
  }

  if (status === "success") {
    return (
      <p
        className="relative z-10 mx-auto mt-8 max-w-[28rem] text-[0.95rem] leading-[1.85] text-[#4a4540] sm:max-w-[32rem]"
        role="status"
      >
        You&apos;re subscribed.
      </p>
    );
  }

  return (
    <div className="relative z-10 mx-auto mt-8 w-full max-w-[28rem] sm:max-w-[32rem]">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center"
        onSubmit={handleSubmit}
      >
        <label htmlFor="ledger-email" className="sr-only">
          Email address
        </label>
        <input
          id="ledger-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isDisabled}
          required
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={isDisabled}
          className={BUTTON_CLASS}
        >
          {status === "submitting" ? "SENDING" : "SUBSCRIBE"}
        </button>
      </form>
      {status === "error" ? (
        <p
          className="mt-3 text-[0.88rem] leading-[1.65] text-[#8a5048]"
          role="alert"
        >
          Something went wrong. Please try again.
        </p>
      ) : null}
    </div>
  );
}