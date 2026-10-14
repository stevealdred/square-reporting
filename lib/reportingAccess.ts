/**
 * Sign-in check for the suites sales route.
 *
 * A browser session from the reporting site is enough for the website.
 * Excel does not send that cookie. Web API authentication sends
 * SUITES_SALES_EXCEL_KEY as the api_key query parameter. The key stays in
 * Excel's credential manager, not in the workbook.
 */

import { timingSafeEqual } from "crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { isEntraTenantAllowed } from "@/lib/entraTenants";
import { excelSignInRequired } from "@/lib/excelSignIn";

const MIN_EXCEL_KEY_LENGTH = 16;

const entraKeys = createRemoteJWKSet(
  new URL("https://login.microsoftonline.com/common/discovery/v2.0/keys"),
);

export function accessTokenAudiences(origin: string, clientId: string | undefined): string[] {
  const values = new Set<string>();
  const site = origin.replace(/\/$/, "");
  if (site) values.add(site);
  if (clientId) {
    values.add(clientId);
    values.add(`api://${clientId}`);
  }
  return [...values];
}

export function payloadIsAllowed(payload: JWTPayload, audiences: string[]): boolean {
  const tid = typeof payload.tid === "string" ? payload.tid : undefined;
  if (!isEntraTenantAllowed(tid)) return false;
  const aud = payload.aud;
  const list = Array.isArray(aud) ? aud : aud ? [aud] : [];
  return list.some((value) => audiences.includes(value));
}

export function configuredExcelKey(): string | null {
  const key = process.env.SUITES_SALES_EXCEL_KEY?.trim();
  if (!key || key.length < MIN_EXCEL_KEY_LENGTH) return null;
  return key;
}

export function excelKeyMatches(token: string): boolean {
  const key = configuredExcelKey();
  if (!key) return false;
  const left = Buffer.from(token);
  const right = Buffer.from(key);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function requireReportingAccess(req: NextRequest): Promise<NextResponse | null> {
  if (await hasSiteSession()) return null;

  const token = bearerToken(req);
  const apiKey = req.nextUrl.searchParams.get("api_key");
  if ((token && excelKeyMatches(token)) || (apiKey && excelKeyMatches(apiKey))) return null;
  if (token && (await accessTokenIsAllowed(token, req.nextUrl.origin))) return null;
  if (token || apiKey) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  return excelSignInRequired();
}

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)/i.exec(header);
  return match?.[1] ?? null;
}

async function hasSiteSession(): Promise<boolean> {
  try {
    const session = await auth();
    return Boolean(session?.user);
  } catch {
    return false;
  }
}

async function accessTokenIsAllowed(token: string, origin: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, entraKeys, { clockTolerance: 60 });
    const audiences = accessTokenAudiences(
      origin,
      process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim(),
    );
    return payloadIsAllowed(payload, audiences);
  } catch {
    return false;
  }
}

