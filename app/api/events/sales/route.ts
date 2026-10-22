import { NextResponse, type NextRequest } from "next/server";
import {
  loadEventsSales,
  parsePayPeriod,
  parseRequestedLocations,
} from "@/lib/eventsSales";
import { requireReportingAccess } from "@/lib/reportingAccess";
import { resolveAccountToken } from "@/lib/squareAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Event workbook refresh. Returns Date × Location totals.
 * Square token stays server-side.
 */
function readLocationsParam(raw: string | null): { locations: unknown } | { error: string } {
  if (raw == null || raw.trim() === "") {
    return { error: "Send the Square location ids from the Square sheet." };
  }
  try {
    return { locations: JSON.parse(raw) };
  } catch {
    return { error: "locations must be a JSON list of location and id." };
  }
}

async function handleSales(
  req: NextRequest,
  start: string | null,
  end: string | null,
  locations: unknown,
) {
  const denied = await requireReportingAccess(req);
  if (denied) return denied;

  const period = parsePayPeriod(start, end);
  if ("error" in period) {
    return NextResponse.json({ error: period.error }, { status: 400 });
  }

  const requested = parseRequestedLocations(locations);
  if ("error" in requested) {
    return NextResponse.json({ error: requested.error }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = resolveAccountToken();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Square account is not configured.",
      },
      { status: 500 },
    );
  }

  const result = await loadEventsSales(
    period.start,
    period.end,
    accessToken,
    requested.locations,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.rows);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const locations = readLocationsParam(params.get("locations"));
  if ("error" in locations) {
    return NextResponse.json({ error: locations.error }, { status: 400 });
  }
  return handleSales(req, params.get("start"), params.get("end"), locations.locations);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const start = typeof record.start === "string" ? record.start : null;
  const end = typeof record.end === "string" ? record.end : null;
  return handleSales(req, start, end, record.locations);
}
