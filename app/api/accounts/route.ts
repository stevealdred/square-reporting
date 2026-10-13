import { NextResponse, type NextRequest } from "next/server";
import {
  accountIdFromRequest,
  isValidAccountId,
  listAccounts,
  resolveAccountId,
  SQUARE_ACCOUNT_COOKIE,
} from "@/lib/squareAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accounts = listAccounts();
  const activeId = resolveAccountId(
    accountIdFromRequest(req.headers.get("cookie")),
  );
  return NextResponse.json({
    ok: true,
    accounts,
    activeId,
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const accountId =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { accountId?: unknown }).accountId === "string"
      ? (body as { accountId: string }).accountId.trim()
      : "";

  if (!accountId || !isValidAccountId(accountId)) {
    return NextResponse.json(
      { ok: false, error: "Unknown Square account id." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    activeId: accountId,
    accounts: listAccounts(),
  });

  response.cookies.set({
    name: SQUARE_ACCOUNT_COOKIE,
    value: accountId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
