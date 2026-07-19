"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FIELD_LABELS } from "@/lib/calibration-library/fields";
import { CALIBRATION_SAFETY_FLAG_LABELS } from "@/lib/calibration-library/calibration-safety";
import type { DistributionCalibrationReport } from "@/lib/calibration-library/distribution-calibration";
import {
  sortLpTestRows,
  type LpSortKey,
} from "@/lib/calibration-library/distribution-calibration";
import type { CrossLabConsistencyReport } from "@/lib/calibration-library/light-performance-cross-lab";
import {
  CALIBRATION_BANDS,
  type CalibrationReviewRecord,
  type CalibrationReviewReport,
} from "@/lib/calibration-library/light-performance-calibration-review";
import {
  LP_TEST_OPTIONAL_KEYS,
  LP_TEST_REQUIRED_KEYS,
  lowConfidenceFieldKeys,
  type LpTestRow,
  type LpTestStatus,
  type LpTestSummary,
} from "@/lib/calibration-library/light-performance-test-rows";
import { SCORING_METADATA_ONLY_KEYS } from "@/lib/calibration-library/scoring/scoring-inputs";
import type { ReportFieldKey } from "@/lib/calibration-library/types";

const STATUS_STYLES: Record<LpTestStatus, string> = {
  READY: "bg-emerald-100 text-emerald-900 border-emerald-300",
  MISSING: "bg-rose-100 text-rose-900 border-rose-300",
  MISMATCH: "bg-amber-100 text-amber-950 border-amber-400",
  WARNING: "bg-yellow-100 text-yellow-950 border-yellow-400",
  UNSCORED: "bg-slate-200 text-slate-800 border-slate-400",
};

type Props = {
  rows: LpTestRow[];
  summary: LpTestSummary;
  crossLab: CrossLabConsistencyReport;
  calibrationReview: CalibrationReviewReport;
  distributionCalibration: DistributionCalibrationReport;
  storageBackend: string;
};

const FLAG_CHIP_CLASS =
  "inline-block rounded border border-slate-400 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800 mr-1 mb-1";

function formatScore(v: number | null): string {
  if (v == null) return "—";
  return String(v);
}

function FieldChecklist({
  title,
  keys,
  fields,
  presentKeys,
}: {
  title: string;
  keys: ReportFieldKey[];
  fields: Record<ReportFieldKey, string>;
  presentKeys: ReportFieldKey[];
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {keys.map((key) => {
          const ok = presentKeys.includes(key);
          return (
            <li key={key} className="flex gap-2">
              <span className={ok ? "text-emerald-700" : "text-rose-700"}>
                {ok ? "✓" : "✗"}
              </span>
              <span className="text-slate-700">{FIELD_LABELS[key]}</span>
              <span className="truncate font-mono text-xs text-slate-500">
                {fields[key] || "(empty)"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function LpTestConsole({
  rows,
  summary,
  crossLab,
  calibrationReview,
  distributionCalibration,
  storageBackend,
}: Props) {
  const reviewById = useMemo(() => {
    const map = new Map<string, CalibrationReviewRecord>();
    for (const r of calibrationReview.reviews) {
      map.set(r.rowId, r);
    }
    return map;
  }, [calibrationReview.reviews]);

  const [lab, setLab] = useState("");
  const [parser, setParser] = useState("");
  const [source, setSource] = useState("");
  const [readyFilter, setReadyFilter] = useState<"" | "ready" | "not-ready">("");
  const [mismatchesOnly, setMismatchesOnly] = useState(false);
  const [reviewFlagsOnly, setReviewFlagsOnly] = useState(false);
  const [syntheticOnly, setSyntheticOnly] = useState(false);
  const [parserOnly, setParserOnly] = useState(false);
  const [sortKey, setSortKey] = useState<LpSortKey>("score-desc");
  const [selectedId, setSelectedId] = useState<string | null>(
    rows[0]?.id ?? null,
  );

  const labs = useMemo(
    () => [...new Set(rows.map((r) => r.lab))].sort(),
    [rows],
  );
  const parsers = useMemo(
    () => [...new Set(rows.map((r) => r.parserType))].sort(),
    [rows],
  );
  const sources = useMemo(
    () => [...new Set(rows.map((r) => r.reportSource))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (lab && r.lab !== lab) return false;
      if (parser && r.parserType !== parser) return false;
      if (source && r.reportSource !== source) return false;
      if (readyFilter === "ready" && !r.scoreReady) return false;
      if (readyFilter === "not-ready" && r.scoreReady) return false;
      if (mismatchesOnly && !r.scoreMismatch) return false;
      if (reviewFlagsOnly) {
        const review = reviewById.get(r.id);
        if (!review?.reviewFlags.length) return false;
      }
      return true;
    });
  }, [rows, lab, parser, source, readyFilter, mismatchesOnly, reviewFlagsOnly, reviewById]);

  const selected =
    filtered.find((r) => r.id === selectedId) ??
    rows.find((r) => r.id === selectedId) ??
    null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-300 bg-white px-6 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">
              Light Performance Internal Test & Calibration Console
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Baseline: {summary.total} records · Score-ready: {summary.scoreReady}{" "}
              · Warnings: {summary.withWarnings} · Mismatches:{" "}
              {summary.mismatches} · Storage: {storageBackend}
            </p>
            <p className="mt-2 inline-block rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900">
              Lab-neutral score: {summary.labNeutralScore ? "yes" : "no"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Scoring uses normalized design inputs only.{" "}
              {SCORING_METADATA_ONLY_KEYS.join(", ")} are metadata — not scoring
              drivers. Lab identity is never passed to the scorer.
            </p>
            <p className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Scores are calibration outputs, not lab grades. Lab identity and lab
              cut labels do not directly affect score.
            </p>
          </div>
          <Link
            href="/calibration-library"
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            ← Ingest
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="rounded border border-indigo-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
            Distribution calibration (Phase 2)
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Total records: {summary.total} · Synthetic:{" "}
            {distributionCalibration.syntheticCount} · Parser-extracted:{" "}
            {distributionCalibration.parserExtractedCount} · Scored eligible:{" "}
            {distributionCalibration.distribution.scoredEligibleCount}
            {distributionCalibration.distribution.average != null
              ? ` · Avg ${distributionCalibration.distribution.average} · Min ${distributionCalibration.distribution.min} · Max ${distributionCalibration.distribution.max}`
              : ""}
          </p>

          {distributionCalibration.datasetHealthNotes.length > 0 ? (
            <ul className="mt-3 space-y-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {distributionCalibration.datasetHealthNotes.map((note) => (
                <li key={note}>⚠ {note}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-emerald-800">
              No distribution health warnings at current thresholds.
            </p>
          )}

          <h3 className="mt-4 text-xs font-medium uppercase text-slate-500">
            Histogram (0–10 buckets)
          </h3>
          <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
            {distributionCalibration.histogram.map((b) => (
              <div
                key={b.label}
                className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
              >
                <span className="text-slate-700">{b.label}</span>
                <span className="font-mono font-medium">{b.count}</span>
              </div>
            ))}
          </div>

          <h3 className="mt-4 text-xs font-medium uppercase text-slate-500">
            Calibration bands
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {distributionCalibration.distribution.byBand.map((b) => (
              <div
                key={b.bandId}
                className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">{b.label}</span>
                <span className="ml-2 text-slate-600">({b.count})</span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium uppercase text-slate-500">
                Average by lab
              </h3>
              <ul className="mt-2 text-sm text-slate-700">
                {distributionCalibration.averageByLab.map((l) => (
                  <li key={l.lab}>
                    {l.lab}: {l.average ?? "—"} (n={l.count})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase text-slate-500">
                Average by parser family
              </h3>
              <ul className="mt-2 text-sm text-slate-700">
                {distributionCalibration.averageByParserFamily.map((p) => (
                  <li key={p.parserFamily}>
                    {p.parserFamily}: {p.average ?? "—"} (n={p.count}
                    {p.syntheticCount > 0
                      ? `, ${p.syntheticCount} synthetic`
                      : ""}
                    )
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="text-xs font-medium uppercase text-slate-500">
              Proportion-only vs finish-adjusted (0–10)
            </p>
            <p className="mt-1">
              Full average: {distributionCalibration.finishSpread.averageFull ?? "—"}{" "}
              · Proportion-only est.:{" "}
              {distributionCalibration.finishSpread.averageProportionOnly ?? "—"} ·
              Avg finish spread:{" "}
              {distributionCalibration.finishSpread.averageFinishSpread ?? "—"} (
              {distributionCalibration.finishSpread.withFinishSpread}/
              {distributionCalibration.finishSpread.scoredCount} scored)
            </p>
          </div>

          <details className="mt-4 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">
              Examples per band & tier counts
            </summary>
            <div className="mt-3 space-y-3">
              {distributionCalibration.examplesByBand.map((band) => (
                <div key={band.bandId}>
                  <p className="font-medium text-slate-800">{band.label}</p>
                  {band.examples.length ? (
                    <ul className="mt-1 list-disc pl-5">
                      {band.examples.map((ex) => (
                        <li key={`${ex.lab}-${ex.reportNumber}`}>
                          {ex.lab} {ex.reportNumber} — {ex.score}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">(no examples in band)</p>
                  )}
                </div>
              ))}
              {distributionCalibration.tierCounts.length > 0 ? (
                <div>
                  <p className="font-medium text-slate-800">Calibration tiers</p>
                  <ul className="mt-1 list-disc pl-5">
                    {distributionCalibration.tierCounts.map((t) => (
                      <li key={t.tier}>
                        {t.tier}: {t.count}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>

          <details className="mt-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">
              Band scale reference
            </summary>
            <ul className="mt-2 list-disc pl-5">
              {CALIBRATION_BANDS.map((b) => (
                <li key={b.id}>
                  {b.min}–{b.max}: {b.label}
                </li>
              ))}
            </ul>
          </details>
        </section>

        {distributionCalibration.sanityFlags.length > 0 ? (
          <section className="rounded border border-rose-200 bg-rose-50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-rose-900">
              Calibration sanity checks
            </h2>
            <ul className="mt-2 max-h-48 overflow-auto text-sm text-rose-950">
              {distributionCalibration.sanityFlags.map((s, i) => (
                <li key={`${s.rowId}-${s.flag}-${i}`} className="py-1">
                  {s.lab ? `${s.lab} ` : ""}
                  {s.reportNumber}: {s.flag}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {calibrationReview.suspicious.length > 0 ? (
          <section className="rounded border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Review flags (derived, not saved)
            </h2>
            <ul className="mt-2 max-h-48 overflow-auto text-sm text-amber-950">
              {calibrationReview.suspicious.map((s) => (
                <li key={`${s.lab}-${s.reportNumber}`} className="py-1">
                  {s.lab} {s.reportNumber}: {s.flags.join("; ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded border border-slate-300 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cross-lab consistency (recalculated scores)
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Full scoring-driver groups (proportions + reported finish lines):{" "}
            {crossLab.fullDriverGroups.length} multi-lab groups,{" "}
            {crossLab.fullDriverInconsistencies.length} inconsistent.
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Proportion-design groups (table/depth/crown/pavilion/lower-half/star):{" "}
            {crossLab.proportionDesignGroups.length} multi-lab groups,{" "}
            {crossLab.proportionInconsistencies.length} with score spread
            (finish/metadata differences — see notes).
          </p>
          {crossLab.proportionInconsistencies.length > 0 ? (
            <ul className="mt-3 max-h-40 overflow-auto text-xs text-amber-900">
              {crossLab.proportionInconsistencies.map((g) => (
                <li key={g.fingerprint} className="border-t border-amber-200 py-2">
                  Labs {g.labs.join(", ")} · scores {g.scores.join(", ")} · reports{" "}
                  {g.reportNumbers.join(", ")}
                  {g.note ? ` — ${g.note}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-emerald-800">
              No proportion-design cross-lab score conflicts in seeded set.
            </p>
          )}
        </section>

        <section className="rounded border border-slate-300 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filters
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="text-sm">
              <span className="mr-2 text-slate-600">Lab</span>
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={lab}
                onChange={(e) => setLab(e.target.value)}
              >
                <option value="">All</option>
                {labs.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mr-2 text-slate-600">Parser</span>
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={parser}
                onChange={(e) => setParser(e.target.value)}
              >
                <option value="">All</option>
                {parsers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mr-2 text-slate-600">Source</span>
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">All</option>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mr-2 text-slate-600">Ready</span>
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={readyFilter}
                onChange={(e) =>
                  setReadyFilter(e.target.value as "" | "ready" | "not-ready")
                }
              >
                <option value="">All</option>
                <option value="ready">Score-ready</option>
                <option value="not-ready">Not score-ready</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mismatchesOnly}
                onChange={(e) => setMismatchesOnly(e.target.checked)}
              />
              Mismatches only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reviewFlagsOnly}
                onChange={(e) => setReviewFlagsOnly(e.target.checked)}
              />
              Review flags only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={syntheticOnly}
                onChange={(e) => setSyntheticOnly(e.target.checked)}
              />
              Synthetic only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={parserOnly}
                onChange={(e) => setParserOnly(e.target.checked)}
              />
              Parser-extracted only
            </label>
            <label className="text-sm">
              <span className="mr-2 text-slate-600">Sort</span>
              <select
                className="rounded border border-slate-300 px-2 py-1"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as LpSortKey)}
              >
                <option value="score-desc">Score (high → low)</option>
                <option value="score-asc">Score (low → high)</option>
                <option value="spread-desc">Spread proxy (depth − table)</option>
                <option value="spread-asc">Spread proxy (asc)</option>
                <option value="crown-pavilion">Crown / pavilion</option>
                <option value="missing-fields">Missing fields</option>
                <option value="finish-influence">Finish influence</option>
                <option value="report-number">Report #</option>
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-slate-300 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Report #</th>
                  <th className="px-3 py-2">Lab</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Parser</th>
                  <th className="px-3 py-2">Stored</th>
                  <th className="px-3 py-2">Recalc</th>
                  <th className="px-3 py-2">Cal (0–10)</th>
                  <th className="px-3 py-2">Cal band</th>
                  <th className="px-3 py-2">Δ</th>
                  <th className="px-3 py-2">Cal safe</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const cal = reviewById.get(row.id);
                  return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                      selectedId === row.id ? "bg-slate-100" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.reportNumber}
                      {row.syntheticCalibration ? (
                        <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-900">
                          SYNTH
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{row.lab}</td>
                    <td className="px-3 py-2 text-xs">{row.reportSource}</td>
                    <td className="px-3 py-2 text-xs">{row.parserType}</td>
                    <td className="px-3 py-2">{formatScore(row.storedScore)}</td>
                    <td className="px-3 py-2">
                      {formatScore(row.recalculatedScore)}
                    </td>
                    <td className="px-3 py-2">
                      {cal?.calibrationScore ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {cal?.calibrationBandLabel ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.scoreDelta != null ? row.scoreDelta : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.calibrationEligible ? (
                        <span className="text-emerald-800">yes</span>
                      ) : (
                        <span className="text-rose-800" title={row.safetyFlags.map((f) => CALIBRATION_SAFETY_FLAG_LABELS[f as keyof typeof CALIBRATION_SAFETY_FLAG_LABELS] ?? f).join("; ")}>
                          no
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No records match filters.</p>
          ) : null}
        </section>

        {selected ? (
          <section className="rounded border border-slate-300 bg-white p-4">
            <h2 className="text-sm font-semibold">Calibration review</h2>
            {reviewById.get(selected.id) ? (
              <CalibrationReviewPanel review={reviewById.get(selected.id)!} />
            ) : null}

            <h2 className="mt-8 text-sm font-semibold">Record detail</h2>
            <p className="mt-1 font-mono text-xs text-slate-600">
              {selected.lab} · {selected.reportNumber} · id {selected.id}
              {selected.seeded ? " · seeded" : ""}
              {selected.syntheticCalibration
                ? ` · synthetic calibration (${selected.calibrationTier ?? "tier n/a"})`
                : ""}
            </p>

            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <FieldChecklist
                title="Required fields"
                keys={LP_TEST_REQUIRED_KEYS}
                fields={selected.entry.fieldsNormalized}
                presentKeys={selected.requiredPresent}
              />
              <FieldChecklist
                title="Optional fields"
                keys={LP_TEST_OPTIONAL_KEYS}
                fields={selected.entry.fieldsNormalized}
                presentKeys={selected.optionalPresent}
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Stored score</p>
                <p className="text-lg font-semibold">
                  {formatScore(selected.storedScore)}
                </p>
                <p className="text-xs text-slate-500">
                  eligible: {String(selected.storedEligible)}
                </p>
              </div>
              <div className="rounded border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Recalculated score</p>
                <p className="text-lg font-semibold">
                  {formatScore(selected.recalculatedScore)}
                </p>
                <p className="text-xs text-slate-500">
                  eligible: {String(selected.recalculatedEligible)}
                </p>
              </div>
              <div className="rounded border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Delta</p>
                <p className="text-lg font-semibold">
                  {selected.scoreDelta != null ? selected.scoreDelta : "—"}
                </p>
              </div>
              <div className="rounded border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Readiness</p>
                <p className="text-lg font-semibold">
                  {selected.scoreReady ? "score-ready" : "not ready"}
                </p>
                <p className="text-xs text-slate-500">{selected.status}</p>
              </div>
            </div>

            {selected.ineligibleReason ? (
              <p className="mt-4 text-sm text-slate-700">
                Ineligible: {selected.ineligibleReason}
              </p>
            ) : null}

            {selected.warnings.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-medium uppercase text-slate-500">
                  Warnings
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                  {selected.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">Warnings: none</p>
            )}

            <div className="mt-4">
              <p className="text-xs font-medium uppercase text-slate-500">
                Low / missing confidence
              </p>
              <p className="mt-1 font-mono text-xs text-slate-700">
                {lowConfidenceFieldKeys(selected.entry.confidence).join(", ") ||
                  "(none flagged)"}
              </p>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Extracted fields (raw, immutable)
                </p>
                <pre className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs">
                  {JSON.stringify(selected.entry.extractedFieldsRaw, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Normalized fields (scoring input)
                </p>
                <pre className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs">
                  {JSON.stringify(selected.entry.fieldsNormalized, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase text-slate-500">
                Lab grade metadata (not scoring drivers)
              </p>
              <p className="mt-1 font-mono text-xs text-slate-700">
                cutGrade: {selected.entry.fieldsNormalized.cutGrade || "(empty)"}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase text-slate-500">
                Parser metadata
              </p>
              <pre className="mt-2 max-h-56 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 font-mono text-xs">
                {JSON.stringify(
                  {
                    parserType: selected.entry.parserType,
                    parserConfidence: selected.entry.parserConfidence,
                    textMethod: selected.entry.textMethod,
                    parserMetadata: selected.entry.parserMetadata,
                    missingFields: selected.missingFields,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function CalibrationReviewPanel({ review }: { review: CalibrationReviewRecord }) {
  return (
    <div className="mt-4 space-y-4 rounded border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Calibration score (0–10)</p>
          <p className="text-xl font-semibold">
            {review.calibrationScore ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Calibration band</p>
          <p className="text-sm font-medium">{review.calibrationBandLabel}</p>
          <p className="text-xs text-slate-500">
            Engine band (v1): {review.engineBand ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Proportion-only (est.)</p>
          <p className="text-lg font-semibold">
            {review.proportionOnlyCalibrationScore ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Finish spread (0–10)</p>
          <p className="text-lg font-semibold">
            {review.finishSpreadCalibration ?? "—"}
          </p>
        </div>
      </div>

      {review.reviewFlags.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Review flags (derived, session-only)
          </p>
          <div className="mt-2">
            {review.reviewFlags.map((f) => (
              <span key={f.id} className={FLAG_CHIP_CLASS}>
                {f.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">No derived review flags.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Primary strengths
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
            {review.strengths.length
              ? review.strengths.map((s) => <li key={s}>{s}</li>)
              : <li>None highlighted</li>}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Primary tradeoffs
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
            {review.tradeoffs.length
              ? review.tradeoffs.map((t) => <li key={t}>{t}</li>)
              : <li>None highlighted</li>}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Scoring drivers used
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {review.scoringDriversUsed.join(", ") || "(none)"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Lab metadata not used in score
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {review.metadataNotUsed.join(", ")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Missing required
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {review.missingRequired.length
              ? review.missingRequired.join(", ")
              : "(none)"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">
            Missing optional
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {review.missingOptional.length
              ? review.missingOptional.join(", ")
              : "(none)"}
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-600">
        Provenance: parser {review.parserType} · confidence{" "}
        {review.parserConfidence ?? "n/a"} · source {review.reportSource} · text{" "}
        {review.textMethod ?? "n/a"}
      </p>
    </div>
  );
}
