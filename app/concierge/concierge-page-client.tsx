"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { diamondIntelligencePrefillFromSearchParams } from "@/lib/concierge/diamond-intelligence-context";
import Header from "../shared-components/Header";
import WhisperedPraiseLink from "../shared-components/WhisperedPraiseLink";

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE_MB = 4;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function ConciergePageClient() {
  const searchParams = useSearchParams();
  const [inspirationNotes, setInspirationNotes] = useState("");
  const notesPrefilled = useRef(false);

  const [projectType, setProjectType] = useState("Engagement Ring");
  const [shape, setShape] = useState("Oval");
  const [direction, setDirection] = useState("Quiet Elegance");
  const [presence, setPresence] = useState("Balanced");
  const [timeline, setTimeline] = useState("Flexible");
  const [budget, setBudget] = useState("10–20k");
  const [preferredContact, setPreferredContact] = useState("Email");

  const [files, setFiles] = useState<File[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [formMessage, setFormMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (notesPrefilled.current) return;
    const prefill = diamondIntelligencePrefillFromSearchParams(searchParams);
    if (!prefill) return;
    setInspirationNotes((current) => (current.trim() ? current : prefill));
    notesPrefilled.current = true;
  }, [searchParams]);

  const activePill =
    "rounded-full border border-[#2b2723] bg-[#2b2723] px-3.5 py-1.5 text-[9.5px] uppercase tracking-[0.18em] text-white shadow-[0_10px_20px_rgba(43,39,35,0.10)]";
  const pill =
    "rounded-full border border-[#ddd1c2] bg-white/82 px-3.5 py-1.5 text-[9.5px] uppercase tracking-[0.18em] text-[#6f665d] transition duration-200 hover:border-[#ccbda9] hover:bg-white";

  const directionNote = useMemo(() => {
    if (direction === "Modern Minimal") {
      return "Clean lines, quieter detail, and a more restrained point of view.";
    }
    if (direction === "Classic Timeless") {
      return "Balanced proportion and a sense of permanence that never feels overstated.";
    }
    if (direction === "Bold Presence") {
      return "A stronger visual statement with more sculptural presence.";
    }
    if (direction === "Still Discovering") {
      return "An open starting point we can shape together in the first conversation.";
    }
    return "A softer direction built around balance, proportion, and calm elegance.";
  }, [direction]);

  const briefLine = useMemo(() => {
    const project =
      projectType === "Still Exploring" ? "piece" : projectType.toLowerCase();

    const shapeLine =
      shape === "Not Sure Yet"
        ? "a shape still to be refined"
        : `${shape.toLowerCase()} lines`;

    const presenceLine =
      presence === "Still Exploring"
        ? "with room to shape the final presence together"
        : `with a ${presence.toLowerCase()} presence`;

    return `A ${project} guided by ${shapeLine}, a ${direction.toLowerCase()} direction, and ${presenceLine}.`;
  }, [projectType, shape, direction, presence]);

  function normalizePreferredContact(value: string) {
    if (value === "Any Is Fine") return "any";
    return value.toLowerCase();
  }

  function validateIncomingFiles(incomingFiles: File[]) {
    const validFiles: File[] = [];

    for (const file of incomingFiles) {
      const isValidType = ACCEPTED_IMAGE_TYPES.includes(file.type);
      const isValidSize = file.size <= MAX_IMAGE_SIZE_MB * 1024 * 1024;

      if (!isValidType) continue;
      if (!isValidSize) continue;

      validFiles.push(file);
    }

    return validFiles;
  }

  function mergeFiles(incomingFiles: File[]) {
    const validFiles = validateIncomingFiles(incomingFiles);
    const merged = [...files, ...validFiles].slice(0, MAX_IMAGES);
    setFiles(merged);
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    mergeFiles(selectedFiles);
    event.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    mergeFiles(droppedFiles);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("submitting");
    setFormMessage("");

    try {
      const formData = new FormData(event.currentTarget);

      files.forEach((file) => {
        formData.append("images", file);
      });

      formData.set("projectType", projectType);
      formData.set("shapeInterest", shape);
      formData.set("designDirection", direction);
      formData.set("ringPresence", presence);
      formData.set("timeline", timeline);
      formData.set("budgetRange", budget);
      formData.set(
        "preferredContactMethod",
        normalizePreferredContact(preferredContact)
      );
      formData.set("source", "concierge_page");

      const response = await fetch("/api/concierge", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Unable to submit your request.");
      }

      setSubmitState("success");
      setFormMessage(
        "Thank you. Your note has been received, and we’ll respond thoughtfully."
      );
      setFiles([]);
      formRef.current?.reset();
      setInspirationNotes("");

      setProjectType("Engagement Ring");
      setShape("Oval");
      setDirection("Quiet Elegance");
      setPresence("Balanced");
      setTimeline("Flexible");
      setBudget("10–20k");
      setPreferredContact("Email");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      setSubmitState("error");
      setFormMessage(message);
    }
  }

  const PillRow = ({
    options,
    value,
    setValue,
  }: {
    options: string[];
    value: string;
    setValue: (value: string) => void;
  }) => (
    <div className="mt-4 flex flex-wrap gap-2.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setValue(option)}
          className={value === option ? activePill : pill}
        >
          {option}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#efe8de] text-[#1c1b1a]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header currentPage="concierge" />

        <section className="border-b border-[#e4dbcf] pb-[86px] pt-[60px] md:pb-[102px] md:pt-[72px]">
          <div className="mx-auto max-w-[46rem] text-center">
            <div className="mb-4 text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
              Concierge
            </div>

            <h1 className="text-[2rem] font-light leading-[1.12] tracking-[0.015em] text-[#1f1d1a] md:text-[2.45rem]">
              A better place to begin.
            </h1>

            <div className="mx-auto mt-8 max-w-[42rem]">
              <div className="mb-4 text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
              
              </div>

              <p className="text-[1rem] leading-[1.95] text-[#6a635c] md:text-[1.04rem]">
                You might already know exactly
                what you're looking for, or just have a sense of how it should
                feel. Either is enough. From there, the conversation takes shape
                naturally, focusing on what matters and moving at a pace that
                feels right. We'll keep this easy and stress free.
              </p>

              <p className="mt-6 text-[0.95rem] leading-[1.9] text-[#7a7268]">
                A few details to get started.
              </p>

              <p className="mt-7">
                <WhisperedPraiseLink
                  variant="arrow"
                  className="text-[11px] tracking-[0.1em]"
                >
                  A few reflections from people we&rsquo;ve worked with &rarr;
                </WhisperedPraiseLink>
              </p>
            </div>
          </div>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="mx-auto mt-14 max-w-[980px] rounded-[34px] border border-[#e4dbcf] bg-white/34 p-5 shadow-[0_18px_46px_rgba(45,35,26,0.03)] md:p-7"
          >
            <div className="grid gap-5">
              <div className="rounded-[28px] border border-[#e4dbcf] bg-white/56 p-6 md:p-7">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#8a8177]">
                  The Foundation
                </div>
                <h2 className="mt-2.5 text-[1.12rem] tracking-[-0.02em] text-[#1f1d1a]">
                  The essentials that help shape the conversation.
                </h2>

                <div className="mt-7 space-y-7">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Project Type
                    </div>
                    <PillRow
                      options={[
                        "Engagement Ring",
                        "Custom Jewelry",
                        "Wedding Band",
                        "Still Exploring",
                      ]}
                      value={projectType}
                      setValue={setProjectType}
                    />
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Shape Interest
                    </div>
                    <PillRow
                      options={[
                        "Round",
                        "Oval",
                        "Radiant",
                        "Cushion",
                        "Emerald",
                        "Pear",
                        "Marquise",
                        "Not Sure Yet",
                      ]}
                      value={shape}
                      setValue={setShape}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#e4dbcf] bg-white/56 p-6 md:p-7">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#8a8177]">
                  Design Direction
                </div>
                <h2 className="mt-2.5 text-[1.12rem] tracking-[-0.02em] text-[#1f1d1a]">
                  The tone and direction that feel most natural.
                </h2>

                <div className="mt-7 space-y-7">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Design Direction
                    </div>
                    <PillRow
                      options={[
                        "Quiet Elegance",
                        "Modern Minimal",
                        "Classic Timeless",
                        "Bold Presence",
                        "Still Discovering",
                      ]}
                      value={direction}
                      setValue={setDirection}
                    />
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Ring Presence
                    </div>
                    <PillRow
                      options={[
                        "Understated",
                        "Balanced",
                        "Statement",
                        "Still Exploring",
                      ]}
                      value={presence}
                      setValue={setPresence}
                    />
                  </div>

                  <div className="rounded-[22px] border border-[#e7ddd1] bg-[linear-gradient(160deg,#f4eee6_0%,#fbf8f3_100%)] p-5">
                    <div className="text-[10px] uppercase tracking-[0.26em] text-[#8a8177]">
                      Current Direction
                    </div>
                    <div className="mt-3 text-[1.02rem] tracking-[-0.02em] text-[#201d1a]">
                      {shape} · {direction}
                    </div>
                    <p className="mt-3 max-w-[34rem] text-[14px] leading-7 text-[#6a635c]">
                      {directionNote}
                    </p>
                    <p className="mt-4 text-[14px] leading-7 text-[#615a53]">
                      {briefLine}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#e4dbcf] bg-white/56 p-6 md:p-7">
                <div className="text-[10px] uppercase tracking-[0.32em] text-[#8a8177]">
                  A Few Final Details
                </div>
                <h2 className="mt-2.5 text-[1.12rem] tracking-[-0.02em] text-[#1f1d1a]">
                  A few details that help us respond clearly.
                </h2>

                <div className="mt-7 space-y-7">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Timeline
                    </div>
                    <PillRow
                      options={[
                        "0–2 months",
                        "3–4 months",
                        "6+ months",
                        "Flexible",
                      ]}
                      value={timeline}
                      setValue={setTimeline}
                    />
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Budget Range
                    </div>
                    <PillRow
                      options={[
                        "Under 10k",
                        "10–20k",
                        "20–30k",
                        "30–50k",
                        "50k+",
                      ]}
                      value={budget}
                      setValue={setBudget}
                    />
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Inspiration or Notes
                    </div>
                    <textarea
                      name="inspirationNotes"
                      rows={6}
                      value={inspirationNotes}
                      onChange={(event) => setInspirationNotes(event.target.value)}
                      placeholder="Anything you'd like us to know. References, ideas, timing, or even a rough direction."
                      className="mt-4 w-full resize-none rounded-[18px] border border-[#ddd4c9] bg-white/78 px-4 py-4 text-sm leading-7 text-[#3c3834] outline-none placeholder:text-[#8a8177]"
                    />
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Reference Images
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={handleFileInputChange}
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      className={[
                        "mt-4 cursor-pointer rounded-[22px] border px-5 py-6 transition",
                        isDragging
                          ? "border-[#bfa788] bg-[#f4ece2]"
                          : "border-[#ddd4c9] bg-white/72 hover:border-[#ccbda9]",
                      ].join(" ")}
                    >
                      <p className="text-[13px] uppercase tracking-[0.22em] text-[#857b70]">
                        Add Inspiration
                      </p>
                      <p className="mt-3 text-[14px] leading-7 text-[#6a635c]">
                        Add any inspiration or reference images (optional).
                      </p>
                      <p className="mt-2 text-[13px] leading-6 text-[#8a8177]">
                        Up to {MAX_IMAGES} images. JPG, PNG, or WEBP. Up to{" "}
                        {MAX_IMAGE_SIZE_MB} MB each.
                      </p>
                    </div>

                    {files.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {files.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between rounded-[18px] border border-[#e1d7cb] bg-white/82 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[14px] text-[#3c3834]">
                                {file.name}
                              </p>
                              <p className="text-[12px] text-[#8a8177]">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="ml-4 text-[11px] uppercase tracking-[0.18em] text-[#8a8177] transition hover:text-[#2b2723]"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Contact
                    </div>
                    <p className="mt-2 text-[14px] leading-7 text-[#6f665d]">
                      How you’d prefer we reach out.
                    </p>

                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                          Name
                        </div>
                        <input
                          name="fullName"
                          type="text"
                          placeholder="Your name"
                          required
                          className="mt-3 w-full rounded-[18px] border border-[#ddd4c9] bg-white/78 px-4 py-4 text-sm text-[#3c3834] outline-none placeholder:text-[#8a8177]"
                        />
                      </div>

                      <div>
                        <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                          Email
                        </div>
                        <input
                          name="email"
                          type="email"
                          placeholder="Your email"
                          required
                          className="mt-3 w-full rounded-[18px] border border-[#ddd4c9] bg-white/78 px-4 py-4 text-sm text-[#3c3834] outline-none placeholder:text-[#8a8177]"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                          Phone Number
                        </div>
                        <input
                          name="phone"
                          type="tel"
                          placeholder="Your phone number"
                          className="mt-3 w-full rounded-[18px] border border-[#ddd4c9] bg-white/78 px-4 py-4 text-sm text-[#3c3834] outline-none placeholder:text-[#8a8177]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#857b70]">
                      Preferred Contact
                    </div>
                    <PillRow
                      options={["Email", "Phone", "Text", "Any Is Fine"]}
                      value={preferredContact}
                      setValue={setPreferredContact}
                    />
                  </div>
                </div>

                <div className="mt-10 border-t border-[#e8dfd4] pt-8 text-center">
                  <p className="mx-auto max-w-[34rem] text-[13px] leading-7 text-[#7b7268]">
                    You don’t need to have everything figured out. This is
                    simply a starting point.
                  </p>

                  <button
                    type="submit"
                    disabled={submitState === "submitting"}
                    className="mt-7 inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-wide text-white shadow-[0_14px_28px_rgba(43,39,35,0.12)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitState === "submitting"
                      ? "Sending..."
                      : "Begin the Conversation"}
                  </button>

                  {formMessage && (
                    <p
                      className={`mx-auto mt-5 max-w-[34rem] text-[13px] leading-7 ${
                        submitState === "error"
                          ? "text-[#9b5f54]"
                          : "text-[#6a635c]"
                      }`}
                    >
                      {formMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </form>
        </section>

        <section className="border-t border-[#e4dbcf] py-[88px] md:py-[102px]">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
              A Personal Conversation
            </div>
            <h2 className="text-[2rem] font-light leading-[1.14] tracking-[0.015em] text-[#1f1d1a] md:text-[2.35rem]">
              Thoughtful from the start.
            </h2>
            <p className="mx-auto mt-6 max-w-[32rem] text-[1rem] leading-[1.9] text-[#6a635c] md:text-[1.04rem]">
              No pressure. No expectations. Just a clear place to begin.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}