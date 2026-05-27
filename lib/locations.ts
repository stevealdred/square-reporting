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

export interface LocationsApiResponse {
  ok: boolean;
  locations?: SquareLocation[];
  error?: string;
  cached?: boolean;
  fetchedAt?: number;
}
