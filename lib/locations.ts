import type { SquareLocation } from "./types";

/**
 * Heuristic detector for "this dimension's values are Square location IDs".
 * Square's views (Sales, ItemSales, ModifierSales, Orders, …) consistently
 * expose `location_id` for the foreign key, so a name-based regex is a
 * reliable signal that we should lookup friendly names via the Locations API.
 */
export function isLocationIdMember(member: string): boolean {
  return /\.location_id$/i.test(member);
}

/** Build a lookup Map from location id -> display name. */
export function buildLocationNameMap(
  locations: SquareLocation[] | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!locations) return map;
  for (const loc of locations) {
    if (loc.id && loc.name) {
      map.set(loc.id, loc.name);
    }
  }
  return map;
}

/**
 * Pick the merchant's display currency from Square locations.
 * Prefers ACTIVE locations; uses the most common currency code among them.
 */
export function resolveMerchantCurrency(
  locations: SquareLocation[] | undefined,
): string | undefined {
  if (!locations?.length) return undefined;
  const active = locations.filter(
    (l) => !l.status || l.status.toUpperCase() === "ACTIVE",
  );
  const pool = active.length > 0 ? active : locations;
  const counts = new Map<string, number>();
  for (const loc of pool) {
    const code = loc.currency?.trim().toUpperCase();
    if (!code || !/^[A-Z]{3}$/.test(code)) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

export interface LocationsApiResponse {
  ok: boolean;
  locations?: SquareLocation[];
  /** Resolved ISO 4217 currency for money formatting (from locations or env). */
  currency?: string;
  error?: string;
  cached?: boolean;
  fetchedAt?: number;
}
