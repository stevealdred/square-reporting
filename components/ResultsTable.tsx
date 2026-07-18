"use client";

import { useMemo, useState } from "react";
import {
  formatMeasureValue,
  isCurrencyMember,
  isMeasureMember,
  toNumber,
} from "@/lib/format";
import { buildLocationNameMap, isLocationIdMember } from "@/lib/locations";
import { useLocations } from "@/lib/useLocations";
import type { CubeMeta, ReportingLoadResponse } from "@/lib/types";

interface ResultsTableProps {
  cube: CubeMeta | null;
  data: ReportingLoadResponse["data"];
  columns: string[];
  columnTitles: Record<string, string>;
  /** ISO 4217 code from the merchant's Square locations (e.g. "CAD"). */
  currency?: string;
}

type SortDir = "asc" | "desc" | null;

export function ResultsTable({
  cube,
  data,
  columns,
  columnTitles,
  currency,
}: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Lazy-fetch the location list only when at least one column references
  // location_id; SWR de-dupes against any other components that ask for it.
  const hasLocationCol = useMemo(
    () => columns.some(isLocationIdMember),
    [columns],
  );
  const { data: locationsData } = useLocations(hasLocationCol);
  const locationNames = useMemo(
    () => buildLocationNameMap(locationsData?.locations),
    [locationsData?.locations],
  );
  const moneyCurrency = currency || locationsData?.currency;

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const isMeasure = cube
      ? isMeasureMember(sortKey, cube.measures)
      : false;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (isMeasure) {
        const an = toNumber(av) ?? Number.NEGATIVE_INFINITY;
        const bn = toNumber(bv) ?? Number.NEGATIVE_INFINITY;
        return sortDir === "asc" ? an - bn : bn - an;
      }
      const as = String(av ?? "");
      const bs = String(bv ?? "");
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [data, sortKey, sortDir, cube]);

  function toggleSort(col: string) {
    if (sortKey !== col) {
      setSortKey(col);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    } else setSortDir("asc");
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
        No rows returned. Try widening the date range or relaxing filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="max-h-[60vh] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur">
            <tr>
              {columns.map((col) => {
                const isMeasure = cube
                  ? isMeasureMember(col, cube.measures)
                  : false;
                const isCurrency =
                  cube && isCurrencyMember(col, cube.measures);
                return (
                  <th
                    key={col}
                    scope="col"
                    className={`whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400 ${
                      isMeasure || isCurrency ? "text-right" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="inline-flex items-center gap-1 hover:text-zinc-100"
                    >
                      <span>{columnTitles[col] || col}</span>
                      <span aria-hidden className="text-[9px] text-zinc-600">
                        {sortKey === col
                          ? sortDir === "asc"
                            ? "▲"
                            : sortDir === "desc"
                              ? "▼"
                              : "↕"
                          : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, idx) => (
              <tr
                key={idx}
                className="border-t border-zinc-800/70 hover:bg-zinc-900/40"
              >
                {columns.map((col) => {
                  const isMeasure = cube
                    ? isMeasureMember(col, cube.measures)
                    : false;
                  const measure = cube?.measures.find((m) => m.name === col);
                  const value = row[col];
                  const isLocationCol = isLocationIdMember(col);
                  const locationName =
                    isLocationCol && typeof value === "string"
                      ? locationNames.get(value)
                      : undefined;
                  const display = isMeasure
                    ? formatMeasureValue(value, measure, moneyCurrency)
                    : value == null
                      ? "—"
                      : locationName ?? String(value);
                  return (
                    <td
                      key={col}
                      title={
                        isLocationCol && locationName && typeof value === "string"
                          ? `${locationName} (${value})`
                          : undefined
                      }
                      className={`whitespace-nowrap px-3 py-2 ${
                        isMeasure
                          ? "text-right font-mono tabular-nums text-zinc-100"
                          : "text-zinc-300"
                      }`}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-500">
        {data.length} row{data.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/** Build a CSV string from the provided rows + column order. */
export function rowsToCsv(
  data: ReportingLoadResponse["data"],
  columns: string[],
  columnTitles: Record<string, string>,
): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(columnTitles[c] || c)).join(",");
  const body = data
    .map((row) => columns.map((c) => escape(row[c])).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}
