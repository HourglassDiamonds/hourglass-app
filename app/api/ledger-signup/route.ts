import { NextResponse } from "next/server";

const HUBSPOT_BASE_URL = "https://api.hubapi.com";

function getHubSpotToken(): string {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN?.trim();

  if (!token) {
    throw new Error("Missing environment variable: HUBSPOT_PRIVATE_APP_TOKEN");
  }

  return token;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hubspotFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getHubSpotToken()}`,
      "Content-Type": "application/json",
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

async function upsertContactByEmail(
  properties: Record<string, string>
): Promise<string> {
  const email = properties.email;

  try {
    const updated = await hubspotFetch<{ id: string }>(
      `/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
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

async function upsertLedgerSubscriber(email: string, subscriptionPage: string) {
  const extended: Record<string, string> = {
    email,
    ledger_subscriber: "true",
    subscription_source: "Hourglass Ledger",
    subscription_page: subscriptionPage,
  };

  try {
    return await upsertContactByEmail(extended);
  } catch (error) {
    console.warn(
      "[ledger-signup] HubSpot contact upsert with Ledger properties failed; retrying with email only.",
      error
    );

    return await upsertContactByEmail({ email });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown;
      subscriptionPage?: unknown;
    };

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const subscriptionPage =
      typeof body.subscriptionPage === "string" &&
      body.subscriptionPage.trim().length > 0
        ? body.subscriptionPage.trim()
        : "/ledger";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address." },
        { status: 400 }
      );
    }

    const contactId = await upsertLedgerSubscriber(email, subscriptionPage);

    return NextResponse.json({ success: true, contactId });
  } catch (error) {
    console.error("[ledger-signup]", error);

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong. Please try again.",
      },
      { status: 500 }
    );
  }
}
