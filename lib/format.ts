import type { MeasureMeta } from "./types";

/**
 * Square returns numeric measures as strings (`"1250.50"`). This module
 * centralises the parsing + presentation logic so every view formats values
 * consistently using the per-measure `format` hint from `/v1/meta`.
 *
 * Currency codes come from the merchant's Square locations (or an optional
 * `SQUARE_CURRENCY` env override exposed via `/api/locations`). Browser locale
 * still controls separators/symbol placement (e.g. en-CA + CAD → `$1,234.56`
 * or `CA$…` depending on the runtime).
 */

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const DEFAULT_CURRENCY = "USD";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const code = /^[A-Za-z]{3}$/.test(currency)
    ? currency.toUpperCase()
    : DEFAULT_CURRENCY;
  let formatter = currencyFormatters.get(code);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(code, formatter);
  }
  return formatter;
}

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMeasureValue(
  value: unknown,
  measure: MeasureMeta | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  const n = toNumber(value);
  if (n === null) return value == null ? "—" : String(value);
  const fmt = measure?.format;
  if (fmt === "currency") return getCurrencyFormatter(currency).format(n);
  if (fmt === "percent") {
    // Square sometimes returns percent as 0–100, sometimes as 0–1. Heuristic:
    // values with abs > 1 are treated as already in 0–100 scale.
    return percentFormatter.format(Math.abs(n) > 1 ? n / 100 : n);
  }
  return numberFormatter.format(n);
}

/** Compact label suitable for chart axis ticks ("1.2K", "3.4M"). */
export function compactNumber(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return compactNumberFormatter.format(n);
}

/** Friendly title for a measure / dimension column. */
export function memberTitle(
  member: string,
  metas: { measures: MeasureMeta[]; dimensions: { name: string; title?: string }[] } | null,
  granularitySuffix?: string,
): string {
  // Time-dimension columns arrive as "Cube.dimension.day".
  const parts = member.split(".");
  const baseMember = parts.length >= 3 ? `${parts[0]}.${parts[1]}` : member;
  const granularity = parts.length >= 3 ? parts.slice(2).join(".") : granularitySuffix;
  if (metas) {
    const m = metas.measures.find((x) => x.name === baseMember);
    if (m?.title) return m.title;
    const d = metas.dimensions.find((x) => x.name === baseMember);
    if (d?.title) {
      return granularity ? `${d.title} (${granularity})` : d.title;
    }
  }
  const tail = baseMember.split(".").slice(1).join(".");
  const human = tail
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return granularity ? `${human} (${granularity})` : human;
}

export function isCurrencyMember(
  member: string,
  measures: MeasureMeta[],
): boolean {
  return measures.some((m) => m.name === member && m.format === "currency");
}

export function isMeasureMember(
  member: string,
  measures: MeasureMeta[],
): boolean {
  return measures.some((m) => m.name === member);
}
