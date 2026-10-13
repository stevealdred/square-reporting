import { NextResponse, type NextRequest } from "next/server";
import { resolveAccountToken } from "@/lib/squareAccounts";
import { loadSuitesSales, parsePayPeriod } from "@/lib/suitesSales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Same Hobby cap as /api/query. Net sales and service charge run in parallel.
export const maxDuration = 60;

/**
 * Workbook refresh. Returns location totals only.
 * The Square token stays in the server environment and is not in this response.
 */
export async function GET(req: NextRequest) {
  const period = parsePayPeriod(
    req.nextUrl.searchParams.get("start"),
    req.nextUrl.searchParams.get("end"),
  );
  if ("error" in period) {
    return NextResponse.json({ error: period.error }, { status: 400 });
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

  const result = await loadSuitesSales(period.start, period.end, accessToken);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.rows);
}
