"use client";

import useSWR, { type SWRResponse } from "swr";
import type { LocationsApiResponse } from "./locations";

const fetcher = async (url: string): Promise<LocationsApiResponse> => {
  const res = await fetch(url);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = { ok: false, error: `Invalid response (HTTP ${res.status})` };
  }
  return json as LocationsApiResponse;
};

/**
 * Shared SWR-backed hook for the merchant's location list.
 *
 * Pass `enabled: false` when there's nothing on the page that needs
 * locations — SWR treats a `null` key as "skip the fetch entirely". When at
 * least one component on the page has `enabled: true`, all callers see the
 * same cached response (SWR de-dupes by URL).
 */
export function useLocations(
  enabled = true,
): SWRResponse<LocationsApiResponse> {
  return useSWR<LocationsApiResponse>(
    enabled ? "/api/locations" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );
}
