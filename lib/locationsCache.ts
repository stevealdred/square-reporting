import type { SquareLocation } from "./types";
import { fetchLocations } from "./squareLocations";

interface CacheEntry {
  locations: SquareLocation[];
  fetchedAt: number;
}

const cache: { current: CacheEntry | null } = { current: null };

function ttlMs(): number {
  const raw = process.env.LOCATIONS_CACHE_TTL_SECONDS;
  const seconds = raw ? Number(raw) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 60 * 60 * 1000;
  }
  return seconds * 1000;
}

export interface GetLocationsResult {
  ok: boolean;
  status: number;
  locations?: SquareLocation[];
  error?: string;
  cached: boolean;
  fetchedAt?: number;
}

/**
 * Module-level in-memory cache for the merchant's location list. Locations
 * change very rarely, so an hour-long TTL is a good default. Use `force` (or
 * call `invalidateLocationsCache`) after a known change.
 */
export async function getCachedLocations(
  options: { force?: boolean } = {},
): Promise<GetLocationsResult> {
  const now = Date.now();
  if (
    !options.force &&
    cache.current &&
    now - cache.current.fetchedAt < ttlMs()
  ) {
    return {
      ok: true,
      status: 200,
      locations: cache.current.locations,
      cached: true,
      fetchedAt: cache.current.fetchedAt,
    };
  }

  const result = await fetchLocations();
  if (!result.ok || !result.locations) {
    return {
      ok: false,
      status: result.status,
      error: result.error,
      cached: false,
    };
  }

  cache.current = { locations: result.locations, fetchedAt: now };
  return {
    ok: true,
    status: 200,
    locations: result.locations,
    cached: false,
    fetchedAt: now,
  };
}

export function invalidateLocationsCache(): void {
  cache.current = null;
}
