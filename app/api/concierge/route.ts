import { NextResponse } from "next/server";
import {
  buildHumanReadableSource,
  sanitizeAttributionFromFormData,
  type AttributionSnapshot,
} from "@/lib/attribution";
import {
  beginConciergeSubmission,
  checkConciergeRateLimit,
  completeConciergeSubmission,
  CONCIERGE_RATE_LIMIT_ERROR,
  getConciergeClientIp,
  releaseConciergeSubmission,
} from "@/lib/concierge/rate-limit";
import {
  CONCIERGE_MAX,
  normalizePreferredContactMethod,
  truncateField,
  validateConciergeContactFields,
} from "@/lib/concierge/validation";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";
const HUBSPOT_TIMEOUT_MS = 12_000;
const VISITOR_ERROR =
  "We couldn’t send your note just now. Please try again, or contact us directly.";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error("missing_server_configuration");
  }
  return value;
}

function getHubSpotHeaders() {
  return {
    Authorization: `Bearer ${getEnv("HUBSPOT_ACCESS_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function displayContactMethod(value?: string) {
  const normalized = normalizePreferredContactMethod(value);
  if (!normalized) return undefined;
  const map = {
    email: "Email",
    phone: "Phone",
    text: "Text",
    any: "Any",
  } as const;
  return map[normalized];
}

async function hubspotFetch<T>(
  path: string,
  init: RequestInit,
  options?: { treatNotFoundAsEmpty?: boolean },
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HUBSPOT_TIMEOUT_MS);

  try {
    const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...getHubSpotHeaders(),
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 404 && options?.treatNotFoundAsEmpty) {
      return null;
    }

    if (!response.ok) {
      console.error("[concierge-hubspot]", {
        path,
        status: response.status,
      });
      throw new Error("hubspot_request_failed");
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.message === "hubspot_request_failed") {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[concierge-hubspot-timeout]", { path });
      throw new Error("hubspot_timeout");
    }
    console.error("[concierge-hubspot-network]", {
      path,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("hubspot_network_error");
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertContact(payload: {
  email: string;
  fullName: string;
  phone?: string;
  preferredContactMethod?: string;
}) {
  const { firstName, lastName } = splitName(payload.fullName);

  const properties: Record<string, string> = {
    email: payload.email,
    firstname: firstName,
    lastname: lastName,
  };

  if (payload.phone) {
    properties.phone = payload.phone;
  }

  const preferredContactMethod = displayContactMethod(
    payload.preferredContactMethod,
  );

  if (preferredContactMethod) {
    properties.preferred_contact_method = preferredContactMethod;
  }

  const existing = await hubspotFetch<{ id: string }>(
    `/crm/v3/objects/contacts/${encodeURIComponent(
      payload.email,
    )}?idProperty=email`,
    {
      method: "PATCH",
      body: JSON.stringify({ properties }),
    },
    { treatNotFoundAsEmpty: true },
  );

  if (existing?.id) {
    return existing.id;
  }

  const created = await hubspotFetch<{ id: string }>("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });

  if (!created?.id) {
    throw new Error("hubspot_contact_create_failed");
  }

  return created.id;
}

function formatAttributionLines(attribution: AttributionSnapshot): string[] {
  const lines: string[] = [];
  if (attribution.utm_source) lines.push(`UTM Source: ${attribution.utm_source}`);
  if (attribution.utm_medium) lines.push(`UTM Medium: ${attribution.utm_medium}`);
  if (attribution.utm_campaign) {
    lines.push(`UTM Campaign: ${attribution.utm_campaign}`);
  }
  if (attribution.utm_content) {
    lines.push(`UTM Content: ${attribution.utm_content}`);
  }
  if (attribution.utm_term) lines.push(`UTM Term: ${attribution.utm_term}`);
  if (attribution.landing_path) {
    lines.push(`Landing path: ${attribution.landing_path}`);
  }
  if (attribution.referrer_host) {
    const path = attribution.referrer_path
      ? ` ${attribution.referrer_path}`
      : "";
    lines.push(`Referrer host: ${attribution.referrer_host}${path}`);
  }
  if (attribution.last_cta_location) {
    lines.push(`Last CTA: ${attribution.last_cta_location}`);
  }
  if (attribution.originating_tool) {
    lines.push(`Originating Tool: ${attribution.originating_tool}`);
  }
  if (attribution.originating_content) {
    lines.push(`Originating Content: ${attribution.originating_content}`);
  }
  return lines;
}

function buildDealDescription(payload: {
  projectType: string;
  shapeInterest?: string;
  designDirection?: string;
  ringPresence?: string;
  timeline?: string;
  budgetRange?: string;
  preferredContactMethod?: string;
  inspirationNotes?: string;
  source: string;
  submissionId: string;
  attribution: AttributionSnapshot;
}) {
  const lines = [
    `Submission ID: ${payload.submissionId}`,
    `Project Type: ${payload.projectType || "Not provided"}`,
    `Shape Interest: ${payload.shapeInterest || "Not provided"}`,
    `Design Direction: ${payload.designDirection || "Not provided"}`,
    `Ring Presence: ${payload.ringPresence || "Not provided"}`,
    `Timeline: ${payload.timeline || "Not provided"}`,
    `Budget Range: ${payload.budgetRange || "Not provided"}`,
    `Preferred Contact: ${
      displayContactMethod(payload.preferredContactMethod) || "Not provided"
    }`,
    `Source: ${payload.source}`,
  ];

  const attributionLines = formatAttributionLines(payload.attribution);
  if (attributionLines.length > 0) {
    lines.push("", "Attribution:", ...attributionLines);
  }

  if (payload.inspirationNotes) {
    lines.push("", "Inspiration / Notes:", payload.inspirationNotes);
  }

  return lines.join("\n");
}

async function createDeal(payload: {
  fullName: string;
  projectType: string;
  shapeInterest?: string;
  designDirection?: string;
  ringPresence?: string;
  timeline?: string;
  budgetRange?: string;
  preferredContactMethod?: string;
  inspirationNotes?: string;
  source: string;
  submissionId: string;
  attribution: AttributionSnapshot;
}) {
  const pipelineId = getEnv("HUBSPOT_DEAL_PIPELINE_ID");
  const stageId = getEnv("HUBSPOT_DEAL_STAGE_ID_NEW_INQUIRY");

  const properties: Record<string, string> = {
    dealname: `${payload.fullName} – ${
      payload.projectType || "Concierge Inquiry"
    }`,
    pipeline: pipelineId,
    dealstage: stageId,
    description: buildDealDescription(payload),
  };

  const created = await hubspotFetch<{ id: string }>("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });

  if (!created?.id) {
    throw new Error("hubspot_deal_create_failed");
  }

  return created.id;
}

async function associateContactToDeal(contactId: string, dealId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HUBSPOT_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${contactId}/associations/deals/${dealId}/contact_to_deal`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getEnv("HUBSPOT_ACCESS_TOKEN")}`,
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.error("[concierge-hubspot-association]", {
        status: response.status,
      });
      throw new Error("hubspot_association_failed");
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function createDealNote(
  dealId: string,
  payload: {
    fullName: string;
    projectType: string;
    shapeInterest?: string;
    designDirection?: string;
    ringPresence?: string;
    timeline?: string;
    budgetRange?: string;
    preferredContactMethod?: string;
    inspirationNotes?: string;
    source: string;
    submissionId: string;
    attribution: AttributionSnapshot;
  },
) {
  const lines = [
    `Submission ID: ${payload.submissionId}`,
    `Client: ${payload.fullName}`,
    `Preferred Contact: ${
      displayContactMethod(payload.preferredContactMethod) || "Not provided"
    }`,
    `Source: ${payload.source}`,
    "",
    `Project Type: ${payload.projectType || "Not provided"}`,
    `Shape Interest: ${payload.shapeInterest || "Not provided"}`,
    `Design Direction: ${payload.designDirection || "Not provided"}`,
    `Ring Presence: ${payload.ringPresence || "Not provided"}`,
    `Timeline: ${payload.timeline || "Not provided"}`,
    `Budget: ${payload.budgetRange || "Not provided"}`,
  ];

  const attributionLines = formatAttributionLines(payload.attribution);
  if (attributionLines.length > 0) {
    lines.push("", "Attribution:", ...attributionLines);
  }

  if (payload.inspirationNotes) {
    lines.push("", "Notes:", payload.inspirationNotes);
  }

  const noteBody = lines.join("\n");

  await hubspotFetch<{ id: string }>("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_note_body: noteBody,
        hs_timestamp: Date.now(),
      },
      associations: [
        {
          to: { id: dealId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 214,
            },
          ],
        },
      ],
    }),
  });
}

function visitorJson(message: string, status: number) {
  return NextResponse.json({ ok: false, accepted: false, message }, { status });
}

function softAcceptJson(submissionId?: string) {
  return NextResponse.json({
    ok: true,
    accepted: false,
    message: "Your request has been received.",
    ...(submissionId ? { submissionId } : {}),
  });
}

function hardAcceptJson(submissionId: string) {
  return NextResponse.json({
    ok: true,
    accepted: true,
    message: "Your request has been received.",
    submissionId,
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // Honeypot first — do not consume rate-limit budget or create CRM records.
    const honeypot = clean(formData.get("company_website"));
    if (honeypot) {
      console.info("[concierge-honeypot]", { rejected: true });
      return softAcceptJson();
    }

    const rate = checkConciergeRateLimit(getConciergeClientIp(request));
    if (!rate.allowed) {
      return visitorJson(CONCIERGE_RATE_LIMIT_ERROR, 429);
    }

    const preferredContactMethod = truncateField(
      clean(formData.get("preferredContactMethod")),
      CONCIERGE_MAX.selection,
    );

    const validated = validateConciergeContactFields({
      fullName: clean(formData.get("fullName")),
      email: clean(formData.get("email")),
      phone: clean(formData.get("phone")),
      preferredContactMethod,
      inspirationNotes: clean(formData.get("inspirationNotes")),
    });

    if (!validated.ok) {
      return visitorJson(validated.message, 400);
    }

    const { fullName, email, phone, notes: inspirationNotes } = validated;

    const projectType = truncateField(
      clean(formData.get("projectType")),
      CONCIERGE_MAX.selection,
    );
    const shapeInterest = truncateField(
      clean(formData.get("shapeInterest")),
      CONCIERGE_MAX.selection,
    );
    const designDirection = truncateField(
      clean(formData.get("designDirection")),
      CONCIERGE_MAX.selection,
    );
    const ringPresence = truncateField(
      clean(formData.get("ringPresence")),
      CONCIERGE_MAX.selection,
    );
    const timeline = truncateField(
      clean(formData.get("timeline")),
      CONCIERGE_MAX.selection,
    );
    const budgetRange = truncateField(
      clean(formData.get("budgetRange")),
      CONCIERGE_MAX.selection,
    );
    const submissionId =
      truncateField(
        clean(formData.get("submissionId")),
        CONCIERGE_MAX.submissionId,
      ) || crypto.randomUUID();

    const attribution = sanitizeAttributionFromFormData(formData);
    const source = buildHumanReadableSource(attribution, "concierge_page");

    // Reject any leftover image uploads — public Blob storage is disabled.
    const imageEntries = formData.getAll("images");
    const hasImages = imageEntries.some(
      (entry) => entry instanceof File && entry.size > 0,
    );
    if (hasImages) {
      return visitorJson(
        "Reference images can be shared securely after the initial conversation.",
        400,
      );
    }

    if (beginConciergeSubmission(submissionId) === "duplicate") {
      console.info("[concierge-duplicate-submission]", {
        submissionId: submissionId.slice(0, 12),
      });
      // Prior accepted lead — do not create another CRM record; treat as accepted.
      return hardAcceptJson(submissionId);
    }

    try {
      const dealPayload = {
        fullName,
        projectType: projectType || "Concierge Inquiry",
        shapeInterest: shapeInterest || undefined,
        designDirection: designDirection || undefined,
        ringPresence: ringPresence || undefined,
        timeline: timeline || undefined,
        budgetRange: budgetRange || undefined,
        preferredContactMethod: preferredContactMethod || undefined,
        inspirationNotes: inspirationNotes || undefined,
        source,
        submissionId,
        attribution,
      };

      const contactId = await upsertContact({
        email,
        fullName,
        phone: phone || undefined,
        preferredContactMethod: preferredContactMethod || undefined,
      });

      const dealId = await createDeal(dealPayload);

      await associateContactToDeal(contactId, dealId);

      try {
        await createDealNote(dealId, dealPayload);
      } catch (noteError) {
        console.error("[concierge-note-nonfatal]", {
          submissionId: submissionId.slice(0, 12),
          error: noteError instanceof Error ? noteError.message : "unknown",
        });
      }

      completeConciergeSubmission(submissionId);

      console.info("[concierge-submit-ok]", {
        submissionId: submissionId.slice(0, 12),
        source,
        hasPhone: Boolean(phone),
      });

      return hardAcceptJson(submissionId);
    } catch (innerError) {
      releaseConciergeSubmission(submissionId);
      throw innerError;
    }
  } catch (error) {
    console.error("[concierge-submit-error]", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return visitorJson(VISITOR_ERROR, 500);
  }
}
