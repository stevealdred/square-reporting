import { NextResponse, type NextRequest } from "next/server";
import { getCachedMeta, invalidateMetaCache } from "@/lib/metaCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  if (force) invalidateMetaCache();

  try {
    const result = await getCachedMeta({ force });
    if (!result.ok || !result.meta) {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          error:
            result.error ||
            "Failed to load schema from Square Reporting API. Confirm SQUARE_ACCESS_TOKEN has the REPORTING_READ scope.",
        },
        { status: result.status >= 400 ? result.status : 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      cached: result.cached,
      fetchedAt: result.fetchedAt,
      meta: result.meta,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        status: 500,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
