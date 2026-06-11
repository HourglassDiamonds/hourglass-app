/**
 * Interpretation-layer grade hints from report text — not part of core field extraction.
 */


export type ReportGradeHints = {
  color?: string;
  clarity?: string;
  /** Natural/fancy colored diamond context detected in text. */
  fancyColor?: boolean;
  coloredDiamondReport?: boolean;
};

/** GIA facsimile PDF text layer — dot leaders between label and value on one line. */
const GIA_DOT_LEADER = String.raw`(?:\.{2,}|[·…\s\-_]{4,})`;

const CLARITY_GRADE_TOKEN =
  String.raw`(FL|IF|VVS\s*[-\s]?1|VVS\s*[-\s]?2|VS\s*[-\s]?1|VS\s*[-\s]?2|SI\s*[-\s]?1|SI\s*[-\s]?2|I\s*[-\s]?1|I\s*[-\s]?2|I\s*[-\s]?3)`;

const CLARITY_DOT_LEADER = new RegExp(
  String.raw`\b(?:clarity|clarit[yq])\s+grade\s+${GIA_DOT_LEADER}\s*${CLARITY_GRADE_TOKEN}\b`,
  "gi",
);

const CLARITY_GRADE_INLINE = new RegExp(
  String.raw`\b(?:clarity|clarit[yq])\s+grade\s+${CLARITY_GRADE_TOKEN}\b`,
  "gi",
);

const CLARITY_GRADE_NEXT_LINE = new RegExp(
  String.raw`\b(?:clarity|clarit[yq])\s+grade\s*\n\s*${CLARITY_GRADE_TOKEN}\b`,
  "gi",
);

/** GIA facsimile grading stack — clarity value before cut label. */
const CLARITY_IN_GRADING_PANEL =
  /\b(?:clarity|clarit[yq])\s+grade\b[\s\S]{0,120}?\bcut\s+grade\b/gi;

const CLARITY_OCR_LABEL_NEXT_LINE = new RegExp(
  String.raw`\b(?:clarity|clarit[yq]|clarit)\s*gr[a-z]{2,6}\b[^\n]{0,32}\n\s*${CLARITY_GRADE_TOKEN}\s*(?:\n|$)`,
  "gi",
);

const CLARITY_OCR_LABEL_PROXIMITY = new RegExp(
  String.raw`\b(?:clarity|clarit[yq])\s*(?:grade|grades|gr[a-z]{0,3})?\b[\s\S]{0,48}?${CLARITY_GRADE_TOKEN}\b`,
  "gi",
);

const CLARITY_OCR_BRACKET_I = /\[\s*I\s*([123])\s*\]/gi;
const CLARITY_OCR_I_NOISE = /\b0\]\s*(1{1,2})\s*\]?\b/gi;
const CLARITY_OCR_SI_SPACED = /\bS\s*I\s*([12])\b/gi;

const CLARITY_TOKEN = new RegExp(String.raw`\b${CLARITY_GRADE_TOKEN}\b`, "i");

const COLOR_GRADE_INLINE =
  /\b(?:colou?r|colour)[ \t]+grade[ \t]+(?![A-Z]\s+to\b)([D-Z](?:[ \t]*[-]?[ \t]*\d+)?)\b/gi;

const COLOR_DOT_LEADER_RANGE = new RegExp(
  String.raw`\b(?:colou?r|colour)\s+grade\s+${GIA_DOT_LEADER}\s*([A-Z]\s+to\s+[A-Z](?:\s+range)?)`,
  "gi",
);

const COLOR_DOT_LEADER_DASH_RANGE = new RegExp(
  String.raw`\b(?:colou?r|colour)\s+grade\s+${GIA_DOT_LEADER}\s*([A-Z])\s*([-–/])\s*([A-Z])(?:\s+range)?`,
  "gi",
);

const COLOR_DOT_LEADER_SINGLE = new RegExp(
  String.raw`\b(?:colou?r|colour)\s+grade\s+${GIA_DOT_LEADER}\s*([D-Z])\b`,
  "gi",
);

const COLOR_GRADE_NEXT_LINE_SINGLE =
  /\b(?:colou?r|colour)\s+grade\s*\n\s*([D-Z])(?:\s*(?:\n|$))/gi;

const COLOR_RANGE_AFTER_LABEL =
  /\b(?:color|colour)\s+grade\s*\n\s*([^\n]+)/gi;

const COLOR_RANGE_INLINE =
  /\b(?:color|colour)\s+grade\s+([A-Z]\s+to\s+[A-Z](?:\s+range)?)/gi;

/** GIA facsimile grading stack — color line before clarity label. */
const COLOR_IN_GRADING_PANEL =
  /\b(?:colou?r|colour)\s+grade\b[\s\S]{0,96}?\b(?:clarity|clarit[yq])\s+grade\b/gi;

const COLOR_OCR_LABEL_NEXT_LINE =
  /\b(?:colou?r|colour|ut|ul)\s*gr[a-z]{2,6}\b[^\n]{0,24}\n\s*([D-Z])\s*(?:\n|$)/gi;

/** GIA LGDR dossier — "Color" / "Clarity" without "Grade" suffix (gated by dossier context). */
const LGDR_COLOR_DOT_LEADER_SINGLE = new RegExp(
  String.raw`\b(?:colou?r|colour)\s+${GIA_DOT_LEADER}\s*([D-Z])\b`,
  "gi",
);

const LGDR_CLARITY_DOT_LEADER = new RegExp(
  String.raw`\b(?:clarity|clarit[yq])\s+${GIA_DOT_LEADER}\s*${CLARITY_GRADE_TOKEN}\b`,
  "gi",
);

const CUT_FINISH_NOISE =
  /\b(?:very|good|excellent|poor|fair|medium|faint|slight|strong|blue|yellow|white|none|symmetry|polish|fluorescence|cut|grading|results|profile|proportions)\b/i;

export type ColorExtractPriority = 1 | 2 | 3 | 4;

export type ColorExtractConfidence = "high" | "medium" | "low";

export type ColorCandidate = {
  value: string;
  priority: ColorExtractPriority;
  source: string;
  confidence: ColorExtractConfidence;
  rawMatch: string;
};

export type ColorExtractionTrace = {
  selected?: string;
  candidates: ColorCandidate[];
  rejected: Array<{ rawMatch: string; reason: string }>;
};

export type ClarityExtractPriority = 1 | 2 | 3 | 4 | 5;

export type ClarityExtractConfidence = "high" | "medium" | "low";

export type ClarityCandidate = {
  value: string;
  priority: ClarityExtractPriority;
  source: string;
  confidence: ClarityExtractConfidence;
  rawMatch: string;
};

export type ClarityExtractionTrace = {
  selected?: string;
  candidates: ClarityCandidate[];
  rejected: Array<{ rawMatch: string; reason: string }>;
};

const CLARITY_CONFIDENCE_RANK: Record<ClarityExtractConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const CLARITY_SOURCE_RANK: Record<string, number> = {
  "clarity-dot-leader": 6,
  "lgdr-clarity-dot-leader": 6,
  "explicit-clarity-grade-inline": 5,
  "explicit-clarity-grade-next-line": 5,
  "clarity-grading-panel": 4,
  "ocr-clarity-label-next-line": 3,
  "ocr-clarity-label-proximity": 2,
  "ocr-clarity-bracket-i": 1,
  "ocr-clarity-i-noise": 1,
  "ocr-clarity-si-spaced": 1,
};

const CONFIDENCE_RANK: Record<ColorExtractConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const COLOR_SOURCE_RANK: Record<string, number> = {
  "color-dot-leader-range": 6,
  "color-dot-leader-dash-range": 6,
  "lgdr-color-dot-leader-single": 6,
  "explicit-color-grade-next-line": 5,
  "color-dot-leader-single": 5,
  "explicit-color-grade-inline": 4,
  "color-range-inline": 3,
  "color-range-after-label": 3,
  "grading-panel-single-line": 2,
  "grading-panel-range-line": 2,
  "ocr-color-label-next-line": 1,
};

function shouldUseNoisyGradeParse(text: string): boolean {
  return (
    /\bgrading\s+results\b/i.test(text) ||
    /\binscription\(s\):\s*gia\b/i.test(text) ||
    /\b(?:clarity|colou?r)\s*(?:grade|grades|gr[a-z]{0,3})\b/i.test(text) ||
    /\b0\]\s*1{1,2}\s*\]?\b/i.test(text) ||
    /\bS\s*I\s*[12]\b/i.test(text)
  );
}

/** LGDR dossier reports use shortened Color/Clarity labels (no "Grade" suffix). */
function isLgdrDossierGradeContext(text: string): boolean {
  return (
    /\bLGDR\b/i.test(text) ||
    /laboratory[-\s]*grown\s+diamond\s+report[\s\S]{0,160}dossier/i.test(
      text,
    ) ||
    /\blaboratory[-\s]*grown\s+diamond\s+specifications\b/i.test(text)
  );
}

function isValidSingleLetterColor(letter: string): boolean {
  return /^[D-Z]$/.test(letter.toUpperCase());
}

function rejectColorCandidate(
  rejected: ColorExtractionTrace["rejected"],
  rawMatch: string,
  reason: string,
): void {
  rejected.push({ rawMatch: rawMatch.slice(0, 120), reason });
}

function pushColorCandidate(
  candidates: ColorCandidate[],
  rejected: ColorExtractionTrace["rejected"],
  input: Omit<ColorCandidate, "value"> & { value: string },
): void {
  const value = input.value.trim();
  if (!value) {
    rejectColorCandidate(rejected, input.rawMatch, "empty value");
    return;
  }
  if (value.length === 1 && !isValidSingleLetterColor(value)) {
    rejectColorCandidate(rejected, input.rawMatch, "not a D–Z letter");
    return;
  }
  if (CUT_FINISH_NOISE.test(value)) {
    rejectColorCandidate(rejected, input.rawMatch, "cut/finish noise phrase");
    return;
  }
  if (/^very\s+good$/i.test(value) || /^excellent$/i.test(value)) {
    rejectColorCandidate(rejected, input.rawMatch, "cut grade phrase");
    return;
  }
  candidates.push({ ...input, value: normalizeColorPhrase(value) });
}

function colorSpecificityScore(value: string): number {
  if (/\bto\b.*\brange\b/i.test(value)) return 3;
  if (/\bto\b/i.test(value)) return 2;
  if (/^[A-Z]\s*[-–/]\s*[A-Z]/i.test(value)) return 2;
  if (value.length === 1) return 0;
  return 1;
}

function collectColorCandidates(text: string): ColorExtractionTrace {
  const candidates: ColorCandidate[] = [];
  const rejected: ColorExtractionTrace["rejected"] = [];

  for (const m of text.matchAll(COLOR_DOT_LEADER_RANGE)) {
    if (!m[1]) continue;
    pushColorCandidate(candidates, rejected, {
      value: normalizeColorPhrase(m[1]),
      priority: 1,
      source: "color-dot-leader-range",
      confidence: "high",
      rawMatch: m[0],
    });
  }

  for (const m of text.matchAll(COLOR_DOT_LEADER_DASH_RANGE)) {
    if (!m[1] || !m[3]) continue;
    pushColorCandidate(candidates, rejected, {
      value: normalizeColorPhrase(`${m[1]!}${m[2]!}${m[3]!}`),
      priority: 1,
      source: "color-dot-leader-dash-range",
      confidence: "high",
      rawMatch: m[0],
    });
  }

  for (const m of text.matchAll(COLOR_DOT_LEADER_SINGLE)) {
    if (!m[1]) continue;
    pushColorCandidate(candidates, rejected, {
      value: normalizeColor(m[1]),
      priority: 1,
      source: "color-dot-leader-single",
      confidence: "high",
      rawMatch: m[0],
    });
  }

  if (isLgdrDossierGradeContext(text)) {
    for (const m of text.matchAll(LGDR_COLOR_DOT_LEADER_SINGLE)) {
      if (!m[1]) continue;
      pushColorCandidate(candidates, rejected, {
        value: normalizeColor(m[1]),
        priority: 1,
        source: "lgdr-color-dot-leader-single",
        confidence: "high",
        rawMatch: m[0],
      });
    }
  }

  for (const m of text.matchAll(COLOR_GRADE_INLINE)) {
    if (!m[1]) continue;
    pushColorCandidate(candidates, rejected, {
      value: normalizeColor(m[1]),
      priority: 1,
      source: "explicit-color-grade-inline",
      confidence: "high",
      rawMatch: m[0],
    });
  }

  for (const m of text.matchAll(COLOR_GRADE_NEXT_LINE_SINGLE)) {
    if (!m[1]) continue;
    pushColorCandidate(candidates, rejected, {
      value: normalizeColor(m[1]),
      priority: 1,
      source: "explicit-color-grade-next-line",
      confidence: "high",
      rawMatch: m[0],
    });
  }

  for (const m of text.matchAll(COLOR_RANGE_INLINE)) {
    if (!m[1]) continue;
    pushColorCandidate(candidates, rejected, {
      value: normalizeColorPhrase(m[1]),
      priority: 2,
      source: "color-range-inline",
      confidence: "high",
      rawMatch: m[0],
    });
  }

  for (const m of text.matchAll(COLOR_RANGE_AFTER_LABEL)) {
    if (!m[1]) continue;
    const val = normalizeColorPhrase(m[1]);
    if (/^clarity\b/i.test(val)) {
      rejectColorCandidate(rejected, m[0], "clarity label captured as color");
      continue;
    }
    pushColorCandidate(candidates, rejected, {
      value: val,
      priority: 2,
      source: "color-range-after-label",
      confidence: "high",
      rawMatch: m[0],
    });
  }

  for (const m of text.matchAll(COLOR_IN_GRADING_PANEL)) {
    const block = m[0];
    const afterColor = block.replace(/^[\s\S]*?\b(?:colou?r|colour)\s+grade\b/i, "");
    const beforeClarity = afterColor.replace(
      /\b(?:clarity|clarit[yq])\s+grade\b[\s\S]*$/i,
      "",
    );
    const line = beforeClarity
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (!line) continue;
    if (/^[D-Z]$/i.test(line)) {
      pushColorCandidate(candidates, rejected, {
        value: normalizeColor(line),
        priority: 3,
        source: "grading-panel-single-line",
        confidence: "medium",
        rawMatch: block.slice(0, 120),
      });
    } else {
      const range =
        line.match(/^([A-Z])\s+to\s+([A-Z])(?:\s+range)?$/i) ??
        beforeClarity.match(/\b([A-Z])\s+to\s+([A-Z])(?:\s+range)?\b/i) ??
        beforeClarity.match(/\b([A-Z])\s*[-–/]\s*([A-Z])(?:\s+range)?\b/i);
      if (range) {
        pushColorCandidate(candidates, rejected, {
          value: normalizeColorPhrase(`${range[1]!} to ${range[2]!}`),
          priority: 3,
          source: "grading-panel-range-line",
          confidence: "medium",
          rawMatch: block.slice(0, 120),
        });
      }
    }
  }

  if (shouldUseNoisyGradeParse(text)) {
    for (const m of text.matchAll(COLOR_OCR_LABEL_NEXT_LINE)) {
      if (!m[1]) continue;
      pushColorCandidate(candidates, rejected, {
        value: normalizeColor(m[1]),
        priority: 4,
        source: "ocr-color-label-next-line",
        confidence: "medium",
        rawMatch: m[0],
      });
    }
  }

  const selected = selectBestColorCandidate(candidates);
  return { selected, candidates, rejected };
}

function selectBestColorCandidate(
  candidates: ColorCandidate[],
): string | undefined {
  if (!candidates.length) return undefined;
  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const conf = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
    if (conf !== 0) return conf;
    return (
      (COLOR_SOURCE_RANK[b.source] ?? 0) - (COLOR_SOURCE_RANK[a.source] ?? 0) ||
      colorSpecificityScore(b.value) - colorSpecificityScore(a.value)
    );
  });
  return sorted[0]?.value;
}

/** Dev / test — ~500 chars centered on the first Color Grade label. */
export function sliceAroundColorGrade(text: string, radius = 250): string {
  const idx = text.search(/\b(?:colou?r|colour)\s+grade\b/i);
  if (idx < 0) {
    return text.slice(0, radius * 2);
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  return text.slice(start, end);
}

export function isUsableDisplayColorValue(value?: string | null): boolean {
  const raw = value?.trim();
  if (!raw) return false;
  const upper = raw.toUpperCase();
  if (/[D-Z]/.test(upper)) return true;
  if (/FANCY|COLORED|COLOUR|COLOR|PINK|BLUE|YELLOW|BROWN|CHAMPAGNE/.test(upper)) {
    return true;
  }
  return raw.length >= 1 && raw.length <= 32;
}

export function isUsableDisplayClarityValue(value?: string | null): boolean {
  const raw = value?.trim();
  if (!raw) return false;
  const compact = raw.replace(/\s+/g, "").toUpperCase().replace(/-/g, "");
  return /^(FL|IF|VVS[12]|VS[12]|SI[12]|I[123])$/.test(compact);
}

/** Dev / test — explain how a color grade was chosen. */
export function traceColorExtraction(text: string): ColorExtractionTrace {
  return collectColorCandidates(text.trim());
}

function parseColorFromText(text: string): string | undefined {
  return collectColorCandidates(text).selected;
}

function isValidClarityGrade(value: string): boolean {
  const compact = value.replace(/\s+/g, "").toUpperCase().replace(/-/g, "");
  return /^(FL|IF|VVS[12]|VS[12]|SI[12]|I[123])$/.test(compact);
}

function rejectClarityCandidate(
  rejected: ClarityExtractionTrace["rejected"],
  rawMatch: string,
  reason: string,
): void {
  rejected.push({ rawMatch: rawMatch.slice(0, 120), reason });
}

function isGradingScaleContext(text: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - 100);
  const end = Math.min(text.length, matchIndex + 100);
  const window = text.slice(start, end);
  return (
    /\bgrading\s+scales?\b/i.test(window) ||
    /\bclarity\s+grading\s+scale\b/i.test(window)
  );
}

function isClarityScaleListing(text: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - 30);
  const end = Math.min(text.length, matchIndex + 140);
  const window = text.slice(start, end);
  const tokens = window.match(
    /\b(?:FL|IF|VVS\s*1|VVS\s*2|VS\s*1|VS\s*2|SI\s*1|SI\s*2|I\s*1|I\s*2|I\s*3|VVS1|VVS2|VS1|VS2|SI1|SI2|I1|I2|I3)\b/gi,
  );
  return (tokens?.length ?? 0) >= 4;
}

function pushClarityCandidate(
  candidates: ClarityCandidate[],
  rejected: ClarityExtractionTrace["rejected"],
  text: string,
  input: Omit<ClarityCandidate, "value"> & { value: string; matchIndex?: number },
): void {
  const raw = input.value.trim();
  if (!raw) {
    rejectClarityCandidate(rejected, input.rawMatch, "empty value");
    return;
  }
  const normalized = normalizeClarityGrade(raw);
  if (!isValidClarityGrade(normalized)) {
    rejectClarityCandidate(rejected, input.rawMatch, "invalid clarity token");
    return;
  }
  if (
    input.matchIndex !== undefined &&
    input.priority >= 4 &&
    isGradingScaleContext(text, input.matchIndex)
  ) {
    rejectClarityCandidate(rejected, input.rawMatch, "grading scale context");
    return;
  }
  if (
    input.matchIndex !== undefined &&
    input.priority >= 4 &&
    isClarityScaleListing(text, input.matchIndex)
  ) {
    rejectClarityCandidate(rejected, input.rawMatch, "clarity scale listing");
    return;
  }
  candidates.push({ ...input, value: normalized });
}

function extractClarityTokenFromPanelBlock(block: string): string | undefined {
  const afterClarity = block.replace(
    /^[\s\S]*?\b(?:clarity|clarit[yq])\s+grade\b/i,
    "",
  );
  const beforeCut = afterClarity.replace(/\bcut\s+grade\b[\s\S]*$/i, "");
  const line = beforeCut
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return undefined;
  const exact = line.match(new RegExp(`^${CLARITY_GRADE_TOKEN}$`, "i"));
  if (exact?.[1]) return exact[1];
  const embedded = beforeCut.match(CLARITY_TOKEN);
  return embedded?.[1];
}

function collectClarityCandidates(text: string): ClarityExtractionTrace {
  const candidates: ClarityCandidate[] = [];
  const rejected: ClarityExtractionTrace["rejected"] = [];

  for (const m of text.matchAll(CLARITY_DOT_LEADER)) {
    if (!m[1]) continue;
    pushClarityCandidate(candidates, rejected, text, {
      value: m[1],
      priority: 1,
      source: "clarity-dot-leader",
      confidence: "high",
      rawMatch: m[0],
      matchIndex: m.index,
    });
  }

  if (isLgdrDossierGradeContext(text)) {
    for (const m of text.matchAll(LGDR_CLARITY_DOT_LEADER)) {
      if (!m[1]) continue;
      pushClarityCandidate(candidates, rejected, text, {
        value: m[1],
        priority: 1,
        source: "lgdr-clarity-dot-leader",
        confidence: "high",
        rawMatch: m[0],
        matchIndex: m.index,
      });
    }
  }

  for (const m of text.matchAll(CLARITY_GRADE_INLINE)) {
    if (!m[1]) continue;
    pushClarityCandidate(candidates, rejected, text, {
      value: m[1],
      priority: 1,
      source: "explicit-clarity-grade-inline",
      confidence: "high",
      rawMatch: m[0],
      matchIndex: m.index,
    });
  }

  for (const m of text.matchAll(CLARITY_GRADE_NEXT_LINE)) {
    if (!m[1]) continue;
    pushClarityCandidate(candidates, rejected, text, {
      value: m[1],
      priority: 1,
      source: "explicit-clarity-grade-next-line",
      confidence: "high",
      rawMatch: m[0],
      matchIndex: m.index,
    });
  }

  for (const m of text.matchAll(CLARITY_IN_GRADING_PANEL)) {
    const token = extractClarityTokenFromPanelBlock(m[0]);
    if (!token) continue;
    pushClarityCandidate(candidates, rejected, text, {
      value: token,
      priority: 2,
      source: "clarity-grading-panel",
      confidence: "medium",
      rawMatch: m[0].slice(0, 120),
      matchIndex: m.index,
    });
  }

  if (shouldUseNoisyGradeParse(text)) {
    for (const m of text.matchAll(CLARITY_OCR_LABEL_NEXT_LINE)) {
      if (!m[1]) continue;
      pushClarityCandidate(candidates, rejected, text, {
        value: m[1],
        priority: 3,
        source: "ocr-clarity-label-next-line",
        confidence: "medium",
        rawMatch: m[0],
        matchIndex: m.index,
      });
    }

    for (const m of text.matchAll(CLARITY_OCR_LABEL_PROXIMITY)) {
      if (!m[1]) continue;
      pushClarityCandidate(candidates, rejected, text, {
        value: m[1],
        priority: 4,
        source: "ocr-clarity-label-proximity",
        confidence: "low",
        rawMatch: m[0],
        matchIndex: m.index,
      });
    }

    for (const m of text.matchAll(CLARITY_OCR_BRACKET_I)) {
      if (!m[1]) continue;
      pushClarityCandidate(candidates, rejected, text, {
        value: `I${m[1]}`,
        priority: 5,
        source: "ocr-clarity-bracket-i",
        confidence: "low",
        rawMatch: m[0],
        matchIndex: m.index,
      });
    }

    for (const m of text.matchAll(CLARITY_OCR_I_NOISE)) {
      if (!m[1]) continue;
      pushClarityCandidate(candidates, rejected, text, {
        value: "I1",
        priority: 5,
        source: "ocr-clarity-i-noise",
        confidence: "low",
        rawMatch: m[0],
        matchIndex: m.index,
      });
    }

    for (const m of text.matchAll(CLARITY_OCR_SI_SPACED)) {
      if (!m[1]) continue;
      pushClarityCandidate(candidates, rejected, text, {
        value: `SI${m[1]}`,
        priority: 5,
        source: "ocr-clarity-si-spaced",
        confidence: "low",
        rawMatch: m[0],
        matchIndex: m.index,
      });
    }
  }

  const selected = selectBestClarityCandidate(candidates);
  return { selected, candidates, rejected };
}

function selectBestClarityCandidate(
  candidates: ClarityCandidate[],
): string | undefined {
  if (!candidates.length) return undefined;
  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const conf =
      CLARITY_CONFIDENCE_RANK[b.confidence] -
      CLARITY_CONFIDENCE_RANK[a.confidence];
    if (conf !== 0) return conf;
    return (
      (CLARITY_SOURCE_RANK[b.source] ?? 0) - (CLARITY_SOURCE_RANK[a.source] ?? 0)
    );
  });
  return sorted[0]?.value;
}

/** Dev / test — ~500 chars centered on the first Clarity Grade label. */
export function sliceAroundClarityGrade(text: string, radius = 250): string {
  const idx = text.search(/\b(?:clarity|clarit[yq])\s+grade\b/i);
  if (idx < 0) {
    return text.slice(0, radius * 2);
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  return text.slice(start, end);
}

/** Dev / test — explain how a clarity grade was chosen. */
export function traceClarityExtraction(text: string): ClarityExtractionTrace {
  return collectClarityCandidates(text.trim());
}

function parseClarityFromText(text: string): string | undefined {
  return collectClarityCandidates(text).selected;
}

function normalizeColorPhrase(raw: string): string {
  let s = raw
    .replace(/\s+/g, " ")
    .replace(/\s*(\.\.+)\s*/g, " ")
    .trim();

  const dashRange = s.match(/^([A-Z])\s*[-–/]\s*([A-Z])(?:\s+range)?$/i);
  if (dashRange) {
    return `${dashRange[1]!.toUpperCase()} to ${dashRange[2]!.toUpperCase()} Range`;
  }

  const toRange = s.match(/^([A-Z])\s+to\s+([A-Z])(?:\s+range)?$/i);
  if (toRange && !/\brange\b/i.test(s)) {
    return `${toRange[1]!.toUpperCase()} to ${toRange[2]!.toUpperCase()} Range`;
  }

  if (/^([A-Z])\s+to\s+([A-Z])\s+range$/i.test(s)) {
    return s.replace(
      /^([A-Z])\s+to\s+([A-Z])\s+range$/i,
      (_, a, b) => `${a.toUpperCase()} to ${b.toUpperCase()} Range`,
    );
  }

  return s;
}

/** Build text source for display-only color/clarity parsing. */
export function buildReportGradeHintSource(input: {
  reportGradeHintText?: string;
  rawTextSnippet?: string;
  warnings?: string[];
}): string {
  const extended = input.reportGradeHintText?.trim();
  if (extended) return extended.slice(0, 16000);

  const snippet = input.rawTextSnippet?.trim();
  const fromWarnings = (input.warnings ?? []).filter(Boolean).join("\n");
  return [snippet, fromWarnings].filter(Boolean).join("\n").slice(0, 16000);
}

export function normalizeClarityGrade(raw: string): string {
  const c = raw.replace(/\s+/g, "").toUpperCase().replace(/-/g, "");
  if (/^I[123]$/.test(c)) return c;
  if (/^VVS[12]$/.test(c)) return c;
  if (/^VS[12]$/.test(c)) return c;
  if (/^SI[12]$/.test(c)) return c;
  if (c === "FL" || c === "IF") return c;
  return c;
}

function normalizeColor(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Parse color/clarity from PDF text snippet — best-effort, never throws. */
export function parseReportGradeHints(text: string): ReportGradeHints {
  const hints: ReportGradeHints = {};
  const t = text.trim();
  if (!t) return hints;

  if (
    /natural\s+colored\s+diamond|fancy\s+(?:vivid|intense|light)|color\s+origin/i.test(
      t,
    )
  ) {
    hints.fancyColor = true;
    hints.coloredDiamondReport = true;
  }

  const clarity = parseClarityFromText(t);
  if (clarity) hints.clarity = clarity;

  const color = collectColorCandidates(t).selected;
  if (color) hints.color = color;

  return hints;
}

export type ClaritySeverity = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Higher = more buyer-relevant clarity concern. */
export function claritySeverity(clarity?: string): ClaritySeverity {
  const c = normalizeClarityGrade(clarity ?? "");
  if (!c) return 0;
  if (c === "FL" || c === "IF") return 0;
  if (c.startsWith("VVS")) return 1;
  if (c.startsWith("VS")) return 2;
  if (c === "SI1") return 3;
  if (c === "SI2") return 4;
  if (c === "I1") return 7;
  if (c === "I2") return 9;
  if (c === "I3") return 10;
  return 2;
}

export function fluorescenceConcern(fluorescence: string): number {
  const f = fluorescence.trim().toLowerCase();
  if (!f || f === "none") return 0;
  if (f.includes("very strong")) return 4;
  if (f.includes("strong")) return 3;
  if (f.includes("medium")) return 2;
  if (f.includes("faint") || f.includes("slight")) return 1;
  return 1;
}

export type ClarityRiskFloor = "Moderate" | "Elevated" | "High";

/** Minimum risk band when clarity is known — consumer risk dominates optics. */
export function clarityRiskFloor(clarity?: string): ClarityRiskFloor | null {
  const c = normalizeClarityGrade(clarity ?? "");
  if (c === "I3" || c === "I2") return "High";
  if (c === "I1") return "Elevated";
  if (c === "SI2") return "Moderate";
  return null;
}

export type RecommendationCeiling =
  | "Strong Candidate"
  | "Worth Reviewing"
  | "Compare Carefully"
  | "Not Recommended";

/** Maximum (best) overall recommendation allowed for a clarity grade. Null = no cap. */
export function clarityRecommendationCeiling(
  clarity?: string,
): RecommendationCeiling | null {
  const c = normalizeClarityGrade(clarity ?? "");
  if (!c) return null;
  if (c === "I3") return "Not Recommended";
  if (c === "I2") return "Not Recommended";
  if (c === "I1") return "Not Recommended";
  if (c === "SI2") return "Worth Reviewing";
  return null;
}

/** Color is preference context — no automatic internal recommendation ceiling. */
export function colorRecommendationCeiling(
  _color?: string,
): RecommendationCeiling | null {
  return null;
}
