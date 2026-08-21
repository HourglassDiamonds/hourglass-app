import { NextResponse } from "next/server";
import {
  getStudioEmailClientIp,
  handleEmailStudioView,
} from "@/lib/diamond-studio/email-view";

export const runtime = "nodejs";
export const maxDuration = 20;

const VISITOR_RETRY =
  "We couldn’t send that just now. Please try again.";

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, accepted: false, message: VISITOR_RETRY },
      { status: 400 },
    );
  }

  const result = await handleEmailStudioView({
    rawBody,
    ip: getStudioEmailClientIp(request),
  });

  if (!result.ok) {
    const headers: HeadersInit = {};
    if (result.retryAfterSeconds) {
      headers["Retry-After"] = String(result.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        ok: false,
        accepted: false,
        message: result.message,
        code: result.code,
      },
      { status: result.status, headers },
    );
  }

  return NextResponse.json({
    ok: true,
    accepted: result.accepted,
    message: result.message,
  });
}
