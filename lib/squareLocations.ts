/**
 * Server-side helper to call Square's Locations API
 * (`GET /v2/locations`). Uses the same `SQUARE_ACCESS_TOKEN` as the Reporting
 * client; the token must have the `MERCHANT_PROFILE_READ` scope.
 */

import type { SquareLocation } from "./types";

const DEFAULT_REPORTING_BASE = "https://connect.squareup.com/reporting";

function getToken(): string {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "SQUARE_ACCESS_TOKEN is not set. Add it to .env.local (token must have the MERCHANT_PROFILE_READ scope to load locations).",
    );
  }
  return token;
}

/**
 * Derive Square's "Connect" base URL (the host used for `/v2/...` endpoints)
 * from `SQUARE_REPORTING_BASE`. Both endpoints share the same host, only the
 * path prefix differs:
 *
 *   reporting: https://connect.squareup.com/reporting/v1/...
 *   connect:   https://connect.squareup.com/v2/...
 */
function getConnectBase(): string {
  const override = process.env.SQUARE_CONNECT_BASE;
  if (override) return override.replace(/\/+$/, "");
  const reporting = (process.env.SQUARE_REPORTING_BASE || DEFAULT_REPORTING_BASE).replace(
    /\/+$/,
    "",
  );
  return reporting.replace(/\/reporting$/, "");
}

export interface FetchLocationsResult {
  status: number;
  ok: boolean;
  locations?: SquareLocation[];
  error?: string;
}

export async function fetchLocations(): Promise<FetchLocationsResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,
    Accept: "application/json",
  };
  if (process.env.SQUARE_API_VERSION) {
    headers["Square-Version"] = process.env.SQUARE_API_VERSION;
  }

  let res: Response;
  try {
    res = await fetch(`${getConnectBase()}/v2/locations`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch (err) {
    return {
      status: 0,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    const detail = extractErrorDetail(body) || `Square Locations API returned ${res.status}`;
    return { status: res.status, ok: false, error: detail };
  }

  const locations =
    (body && typeof body === "object" && Array.isArray((body as { locations?: unknown }).locations)
      ? ((body as { locations: SquareLocation[] }).locations)
      : []) || [];
  return { status: 200, ok: true, locations };
}

function extractErrorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0] as { detail?: string; code?: string; category?: string };
  return first.detail || first.code || first.category;
}
