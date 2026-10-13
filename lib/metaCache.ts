import type { ReportingMeta } from "./types";
import { fetchReportingMeta } from "./squareReporting";

interface CacheEntry {
  meta: ReportingMeta;
  fetchedAt: number;
}

/**
 * Module-level in-memory cache for the Reporting API schema, keyed by Square
 * account id so switching merchants does not reuse another merchant's schema.
 *
 * The schema rarely changes, so we keep the result around for an hour by
 * default (override with `META_CACHE_TTL_SECONDS`). Restarting the dev
 * server clears the cache, and `force: true` will bypass it explicitly.
 */
const cache = new Map<string, CacheEntry>();

function ttlMs(): number {
  const raw = process.env.META_CACHE_TTL_SECONDS;
  const seconds = raw ? Number(raw) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 60 * 60 * 1000;
  }
  return seconds * 1000;
}

export interface GetMetaResult {
  ok: boolean;
  status: number;
  meta?: ReportingMeta;
  error?: string;
  cached: boolean;
  fetchedAt?: number;
}

export async function getCachedMeta(
  accountId: string,
  accessToken: string,
  options: { force?: boolean } = {},
): Promise<GetMetaResult> {
  const now = Date.now();
  const existing = cache.get(accountId);
  if (!options.force && existing && now - existing.fetchedAt < ttlMs()) {
    return {
      ok: true,
      status: 200,
      meta: existing.meta,
      cached: true,
      fetchedAt: existing.fetchedAt,
    };
  }

  const result = await fetchReportingMeta(accessToken);
  if (!result.ok || !result.meta) {
    return {
      ok: false,
      status: result.status,
      error: result.error,
      cached: false,
    };
  }

  cache.set(accountId, { meta: result.meta, fetchedAt: now });
  return {
    ok: true,
    status: 200,
    meta: result.meta,
    cached: false,
    fetchedAt: now,
  };
}

export function invalidateMetaCache(accountId?: string): void {
  if (accountId) {
    cache.delete(accountId);
  } else {
    cache.clear();
  }
}
