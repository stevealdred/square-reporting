import { NextResponse, type NextRequest } from "next/server";
import { getCachedMeta, invalidateMetaCache } from "@/lib/metaCache";
import {
  accountIdFromRequest,
  resolveAccountId,
  resolveAccountToken,
} from "@/lib/squareAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = resolveAccountId(
    accountIdFromRequest(req.headers.get("cookie")),
  );
  if (!accountId) {
    return NextResponse.json(
      {
        ok: false,
        status: 500,
        error:
          "No Square account configured. Set SQUARE_ACCESS_TOKEN, or SQUARE_ACCOUNTS plus per-account tokens.",
      },
      { status: 500 },
    );
  }

  const force = req.nextUrl.searchParams.get("refresh") === "1";
  if (force) invalidateMetaCache(accountId);

  try {
    const accessToken = resolveAccountToken(accountId);
    const result = await getCachedMeta(accountId, accessToken, { force });
    if (!result.ok || !result.meta) {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          error:
            result.error ||
            "Failed to load schema from Square Reporting API. Confirm the active account token has the REPORTING_READ scope.",
        },
        { status: result.status >= 400 ? result.status : 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      accountId,
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
