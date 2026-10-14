import { NextResponse, type NextRequest } from "next/server";
import { requireReportingAccess } from "@/lib/reportingAccess";
import { resolveAccountToken } from "@/lib/squareAccounts";
import { loadSuitesSales, parsePayPeriod, parseRequestedLocations } from "@/lib/suitesSales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Same Hobby cap as /api/query. Net sales and service charge run in parallel.
export const maxDuration = 60;

/**
 * Workbook refresh. Returns location totals only.
 * The Square token stays in the server environment and is not in this response.
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Send the pay period and Square location ids from the Square sheet. Update SquareLocationSales, then refresh again.",
    },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  const denied = await requireReportingAccess(req);
  if (denied) return denied;

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

  const period = parsePayPeriod(
    typeof record.start === "string" ? record.start : null,
    typeof record.end === "string" ? record.end : null,
  );
  if ("error" in period) {
    return NextResponse.json({ error: period.error }, { status: 400 });
  }

  const requested = parseRequestedLocations(record.locations);
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

  const result = await loadSuitesSales(
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
