"use client";

import { formatMeasureValue, toNumber } from "@/lib/format";
import type { CubeMeta, ReportingLoadResponse } from "@/lib/types";

interface SummaryCardsProps {
  cube: CubeMeta | null;
  data: ReportingLoadResponse["data"];
  measureNames: string[];
  /** ISO 4217 code from the merchant's Square locations (e.g. "CAD"). */
  currency?: string;
}

/**
 * Aggregates each selected measure across all returned rows. We sum numeric
 * values regardless of the measure's `aggType` because the API has already
 * applied that aggregation per-row — summing again here recovers the grand
 * total when the query returned a time-series.
 *
 * For `count` / `countDistinct` this matches the dashboard behavior; for
 * `avg`-type measures the sum-of-rows is misleading, so we display the
 * average of the row values instead.
 */
export function SummaryCards({
  cube,
  data,
  measureNames,
  currency,
}: SummaryCardsProps) {
  if (measureNames.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {measureNames.map((name) => {
        const measure = cube?.measures.find((m) => m.name === name);
        const aggType = measure?.aggType ?? "sum";

        const values = data
          .map((row) => toNumber(row[name]))
          .filter((v): v is number => v !== null);

        let total: number | null = null;
        if (values.length > 0) {
          if (aggType === "avg") {
            total = values.reduce((a, b) => a + b, 0) / values.length;
          } else if (aggType === "min") {
            total = Math.min(...values);
          } else if (aggType === "max") {
            total = Math.max(...values);
          } else {
            total = values.reduce((a, b) => a + b, 0);
          }
        }

        return (
          <div
            key={name}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-sm"
            title={measure?.meta?.tooltip || measure?.description}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {measure?.title || name}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-100">
              {total === null
                ? "—"
                : formatMeasureValue(total, measure, currency)}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-wider text-zinc-600">
              {aggType} · {data.length} row{data.length === 1 ? "" : "s"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
