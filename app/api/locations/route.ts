import { NextResponse, type NextRequest } from "next/server";
import { resolveMerchantCurrency } from "@/lib/locations";
import {
  getCachedLocations,
  invalidateLocationsCache,
} from "@/lib/locationsCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envCurrencyOverride(): string | undefined {
  const raw = process.env.SQUARE_CURRENCY?.trim().toUpperCase();
  if (raw && /^[A-Z]{3}$/.test(raw)) return raw;
  return undefined;
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  if (force) invalidateLocationsCache();

  try {
    const result = await getCachedLocations({ force });
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          error:
            result.error ||
            "Failed to load locations. Confirm SQUARE_ACCESS_TOKEN has the MERCHANT_PROFILE_READ scope.",
        },
        { status: result.status >= 400 ? result.status : 500 },
      );
    }
    const locations = result.locations || [];
    const currency =
      envCurrencyOverride() || resolveMerchantCurrency(locations) || "USD";
    return NextResponse.json({
      ok: true,
      cached: result.cached,
      fetchedAt: result.fetchedAt,
      currency,
      locations,
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
