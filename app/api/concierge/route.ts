import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
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

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

function normalizeContactMethod(value?: string) {
  if (!value) return undefined;

  const map: Record<string, string> = {
    email: "Email",
    phone: "Phone",
    text: "Text",
    any: "Any",
  };

  return map[value.toLowerCase()] || value;
}

async function hubspotFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...getHubSpotHeaders(),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HubSpot error ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

type UploadedImage = {
  url: string;
  originalName: string;
  size: number;
};

async function uploadImages(files: File[]) {
  const uploads: UploadedImage[] = [];

  for (const file of files) {
    const safeName = sanitizeFileName(file.name);
    const pathname = `concierge/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const blob = await put(pathname, file, {
      access: "public",
      token: process.env.PUBLIC_BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      contentType: file.type,
    });

    uploads.push({
      url: blob.url,
      originalName: file.name,
      size: file.size,
    });
  }

  return uploads;
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

  const preferredContactMethod = normalizeContactMethod(
    payload.preferredContactMethod
  );

  if (preferredContactMethod) {
    properties.preferred_contact_method = preferredContactMethod;
  }

  try {
    const updated = await hubspotFetch<{ id: string }>(
      `/crm/v3/objects/contacts/${encodeURIComponent(
        payload.email
      )}?idProperty=email`,
      {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      }
    );

    return updated.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("404")) {
      throw error;
    }
  }

  const created = await hubspotFetch<{ id: string }>("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });

  return created.id;
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
  uploadedImages: UploadedImage[];
  source?: string;
}) {
  const lines = [
    `Project Type: ${payload.projectType || "Not provided"}`,
    `Shape Interest: ${payload.shapeInterest || "Not provided"}`,
    `Design Direction: ${payload.designDirection || "Not provided"}`,
    `Ring Presence: ${payload.ringPresence || "Not provided"}`,
    `Timeline: ${payload.timeline || "Not provided"}`,
    `Budget Range: ${payload.budgetRange || "Not provided"}`,
    `Preferred Contact: ${
      normalizeContactMethod(payload.preferredContactMethod) || "Not provided"
    }`,
    `Source: ${payload.source || "concierge_page"}`,
  ];

  if (payload.inspirationNotes) {
    lines.push("", "Inspiration / Notes:", payload.inspirationNotes);
  }

  if (payload.uploadedImages.length > 0) {
    lines.push("", "Uploaded Images:");

    for (const image of payload.uploadedImages) {
      lines.push(`- ${image.originalName}: ${image.url}`);
    }
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
  uploadedImages: UploadedImage[];
  source?: string;
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

  return created.id;
}

async function associateContactToDeal(contactId: string, dealId: string) {
  const response = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/${contactId}/associations/deals/${dealId}/contact_to_deal`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${getEnv("HUBSPOT_ACCESS_TOKEN")}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HubSpot association error ${response.status}: ${text}`);
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
    uploadedImages: UploadedImage[];
  }
) {
  const lines = [
    `Client: ${payload.fullName}`,
    `Preferred Contact: ${
      normalizeContactMethod(payload.preferredContactMethod) || "Not provided"
    }`,
    "",
    `Project Type: ${payload.projectType || "Not provided"}`,
    `Shape Interest: ${payload.shapeInterest || "Not provided"}`,
    `Design Direction: ${payload.designDirection || "Not provided"}`,
    `Ring Presence: ${payload.ringPresence || "Not provided"}`,
    `Timeline: ${payload.timeline || "Not provided"}`,
    `Budget: ${payload.budgetRange || "Not provided"}`,
  ];

  if (payload.inspirationNotes) {
    lines.push("", "Notes:", payload.inspirationNotes);
  }

  if (payload.uploadedImages.length > 0) {
    lines.push("", "Images:");

    for (const image of payload.uploadedImages) {
      lines.push(`- ${image.originalName}: ${image.url}`);
    }
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const fullName = clean(formData.get("fullName"));
    const email = clean(formData.get("email")).toLowerCase();
    const phone = clean(formData.get("phone"));
    const projectType = clean(formData.get("projectType"));
    const shapeInterest = clean(formData.get("shapeInterest"));
    const designDirection = clean(formData.get("designDirection"));
    const ringPresence = clean(formData.get("ringPresence"));
    const timeline = clean(formData.get("timeline"));
    const budgetRange = clean(formData.get("budgetRange"));
    const preferredContactMethod = clean(formData.get("preferredContactMethod"));
    const inspirationNotes = clean(formData.get("inspirationNotes"));
    const source = clean(formData.get("source"));

    if (!fullName) {
      return NextResponse.json(
        { ok: false, message: "Please enter your name." },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const imageEntries = formData.getAll("images");
    const imageFiles = imageEntries.filter(
      (entry): entry is File => entry instanceof File && entry.size > 0
    );

    if (imageFiles.length > MAX_IMAGES) {
      return NextResponse.json(
        {
          ok: false,
          message: `Please upload no more than ${MAX_IMAGES} images.`,
        },
        { status: 400 }
      );
    }

    for (const file of imageFiles) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json(
          { ok: false, message: "Only JPG, PNG, and WEBP images are allowed." },
          { status: 400 }
        );
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { ok: false, message: "Each image must be 4 MB or smaller." },
          { status: 400 }
        );
      }
    }

    const uploadedImages =
      imageFiles.length > 0 ? await uploadImages(imageFiles) : [];

    const contactId = await upsertContact({
      email,
      fullName,
      phone: phone || undefined,
      preferredContactMethod: preferredContactMethod || undefined,
    });

    const dealId = await createDeal({
      fullName,
      projectType: projectType || "Concierge Inquiry",
      shapeInterest: shapeInterest || undefined,
      designDirection: designDirection || undefined,
      ringPresence: ringPresence || undefined,
      timeline: timeline || undefined,
      budgetRange: budgetRange || undefined,
      preferredContactMethod: preferredContactMethod || undefined,
      inspirationNotes: inspirationNotes || undefined,
      uploadedImages,
      source: source || undefined,
    });

    await associateContactToDeal(contactId, dealId);

    await createDealNote(dealId, {
      fullName,
      projectType: projectType || "Concierge Inquiry",
      shapeInterest: shapeInterest || undefined,
      designDirection: designDirection || undefined,
      ringPresence: ringPresence || undefined,
      timeline: timeline || undefined,
      budgetRange: budgetRange || undefined,
      preferredContactMethod: preferredContactMethod || undefined,
      inspirationNotes: inspirationNotes || undefined,
      uploadedImages,
    });

    return NextResponse.json({
      ok: true,
      message: "Your request has been received.",
    });
  } catch (error) {
    console.error("[concierge-submit-error]", error);

    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong while sending your request.";

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 }
    );
  }
}