import { NextResponse, type NextRequest } from "next/server";
import { runReportingQuery } from "@/lib/squareReporting";
import { pruneQuery, reportingQuerySchema } from "@/lib/queryShape";
import type {
  ApiQueryResponse,
  ReportingLoadResponse,
  ReportingQuery,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow long polling for the Continue-wait retry loop. Vercel hobby caps at
// 60s — bump if you deploy elsewhere.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const queryRaw = (body as { query?: unknown })?.query;
  if (queryRaw === undefined) {
    return jsonError(400, 'Missing "query" field in request body.');
  }

  const parsed = reportingQuerySchema.safeParse(queryRaw);
  if (!parsed.success) {
    return jsonError(
      400,
      "Invalid query shape.",
      parsed.error.flatten(),
    );
  }

  const query: ReportingQuery = pruneQuery(parsed.data as ReportingQuery);

  try {
    const result = await runReportingQuery(query);

    if (result.status === 200 && isLoadResponse(result.json)) {
      const payload = result.json;
      const success: ApiQueryResponse = {
        ok: true,
        data: payload.data,
        annotation: payload.annotation,
        slowQuery: !!payload.slowQuery,
        attempts: result.attempts,
      };
      return NextResponse.json(success);
    }

    // Surface the raw error from Square so the UI can render its `detail`.
    const errorPayload = result.json as { error?: string } | null;
    const errorMessage =
      (errorPayload && errorPayload.error) ||
      `Square Reporting API returned HTTP ${result.status}.`;
    const failure: ApiQueryResponse = {
      ok: false,
      status: result.status,
      error: errorMessage,
      detail: result.json,
      attempts: result.attempts,
    };
    return NextResponse.json(failure, {
      status: result.status >= 400 ? result.status : 502,
    });
  } catch (err) {
    return jsonError(
      500,
      err instanceof Error ? err.message : "Unknown server error.",
    );
  }
}

function jsonError(status: number, error: string, detail?: unknown) {
  const body: ApiQueryResponse = { ok: false, status, error, detail };
  return NextResponse.json(body, { status });
}

function isLoadResponse(value: unknown): value is ReportingLoadResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ReportingLoadResponse).data)
  );
}
