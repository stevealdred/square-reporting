/**
 * Server-side helpers that talk to the Square Reporting API.
 *
 * The token is read from `SQUARE_ACCESS_TOKEN` and must have the
 * `REPORTING_READ` scope. This module is intentionally `import "server-only"`
 * adjacent — never import it from a client component.
 */

import type { ReportingMeta, ReportingQuery } from "./types";

const DEFAULT_BASE = "https://connect.squareup.com/reporting";

function getBaseUrl(): string {
  return (process.env.SQUARE_REPORTING_BASE || DEFAULT_BASE).replace(/\/+$/, "");
}

function getToken(): string {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "SQUARE_ACCESS_TOKEN is not set. Add it to .env.local (token must have the REPORTING_READ scope).",
    );
  }
  return token;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface FetchMetaResult {
  status: number;
  ok: boolean;
  meta?: ReportingMeta;
  error?: string;
}

/** GET `/v1/meta` — returns the schema describing all cubes/views. */
export async function fetchReportingMeta(): Promise<FetchMetaResult> {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl()}/v1/meta`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    return {
      status: 0,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    return {
      status: res.status,
      ok: false,
      error: detail || `Square Reporting API returned ${res.status}`,
    };
  }

  try {
    const meta = (await res.json()) as ReportingMeta;
    return { status: 200, ok: true, meta };
  } catch (err) {
    return {
      status: res.status,
      ok: false,
      error: err instanceof Error ? err.message : "Could not parse meta JSON",
    };
  }
}

export interface RunQueryResult {
  status: number;
  json: unknown;
  attempts: number;
}

/**
 * POST `/v1/load` with the `Continue wait` retry loop baked in. Square may
 * return `{"error":"Continue wait"}` (HTTP 200) for slow queries; the client
 * is expected to repeat the same request until the data is ready.
 */
export async function runReportingQuery(
  query: ReportingQuery,
): Promise<RunQueryResult> {
  const maxRetries = envInt("REPORTING_MAX_RETRIES", 10);
  const retryMs = envInt("REPORTING_RETRY_MS", 1500);
  const url = `${getBaseUrl()}/v1/load`;
  const token = getToken();

  let lastJson: unknown = { error: "Continue wait" };
  let lastStatus = 504;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query }),
        cache: "no-store",
      });
    } catch (err) {
      return {
        status: 0,
        attempts: attempt,
        json: {
          error: err instanceof Error ? err.message : "Network error",
        },
      };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      json = { error: `Non-JSON response (HTTP ${res.status})` };
    }

    lastJson = json;
    lastStatus = res.status;

    const isContinueWait =
      res.status === 200 &&
      typeof json === "object" &&
      json !== null &&
      (json as { error?: string }).error === "Continue wait";

    if (!isContinueWait) {
      return { status: res.status, json, attempts: attempt };
    }

    if (attempt < maxRetries) {
      await sleep(retryMs);
    }
  }

  return {
    status: lastStatus === 200 ? 504 : lastStatus,
    json: {
      error: "Reporting query timed out while waiting for results.",
      detail: lastJson,
    },
    attempts: maxRetries,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
