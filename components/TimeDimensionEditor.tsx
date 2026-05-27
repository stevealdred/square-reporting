"use client";

import { useId } from "react";
import { CUSTOM_RANGE_ID, DATE_RANGE_PRESETS } from "@/lib/dateRanges";
import type {
  DimensionMeta,
  Granularity,
  TimeDimensionClause,
} from "@/lib/types";

interface TimeDimensionEditorProps {
  dimensions: DimensionMeta[];
  value: TimeDimensionClause | null;
  onChange: (next: TimeDimensionClause | null) => void;
}

const GRANULARITIES: Array<{ id: "" | Granularity; label: string }> = [
  { id: "", label: "(none — single total)" },
  { id: "hour", label: "Hour" },
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
];

/**
 * Edits the single, optional time-dimension clause attached to the query.
 * Most reporting queries include exactly one (e.g. `Sales.local_reporting_timestamp`),
 * so we model it as a single object rather than an array.
 */
export function TimeDimensionEditor({
  dimensions,
  value,
  onChange,
}: TimeDimensionEditorProps) {
  const dimId = useId();
  const rangeId = useId();
  const granId = useId();

  const timeDims = dimensions.filter((d) => d.type === "time");

  const isCustom = Array.isArray(value?.dateRange);
  const presetId =
    !value?.dateRange
      ? "last-30-days"
      : Array.isArray(value.dateRange)
        ? CUSTOM_RANGE_ID
        : DATE_RANGE_PRESETS.find((p) => p.value === value.dateRange)?.id ??
          CUSTOM_RANGE_ID;

  function update(partial: Partial<TimeDimensionClause>) {
    if (!value) return;
    onChange({ ...value, ...partial });
  }

  function setDimension(name: string) {
    if (!name) {
      onChange(null);
      return;
    }
    onChange({
      dimension: name,
      dateRange: value?.dateRange ?? "last 30 days",
      granularity: value?.granularity ?? "day",
    });
  }

  function setPreset(id: string) {
    if (!value) return;
    if (id === CUSTOM_RANGE_ID) {
      const today = new Date().toISOString().slice(0, 10);
      const earlier = new Date(Date.now() - 30 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      onChange({
        ...value,
        dateRange: Array.isArray(value.dateRange)
          ? value.dateRange
          : [earlier, today],
      });
      return;
    }
    const preset = DATE_RANGE_PRESETS.find((p) => p.id === id);
    if (preset) onChange({ ...value, dateRange: preset.value });
  }

  function setCustomDate(idx: 0 | 1, iso: string) {
    if (!value) return;
    const current: [string, string] = Array.isArray(value.dateRange)
      ? [...(value.dateRange as [string, string])]
      : ["", ""];
    current[idx] = iso;
    onChange({ ...value, dateRange: current });
  }

  if (timeDims.length === 0) {
    return (
      <p className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        This source has no time dimensions.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={dimId}
          className="block text-xs font-medium text-zinc-400"
        >
          Time dimension
        </label>
        <select
          id={dimId}
          value={value?.dimension ?? ""}
          onChange={(e) => setDimension(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
        >
          <option value="">— None —</option>
          {timeDims.map((d) => (
            <option key={d.name} value={d.name}>
              {d.title || d.name}
            </option>
          ))}
        </select>
      </div>

      {value?.dimension && (
        <>
          <div>
            <label
              htmlFor={rangeId}
              className="block text-xs font-medium text-zinc-400"
            >
              Date range
            </label>
            <select
              id={rangeId}
              value={presetId}
              onChange={(e) => setPreset(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
            >
              {DATE_RANGE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value={CUSTOM_RANGE_ID}>Custom range…</option>
            </select>
          </div>

          {isCustom && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-zinc-400">
                Start
                <input
                  type="date"
                  value={
                    Array.isArray(value.dateRange)
                      ? (value.dateRange as [string, string])[0]
                      : ""
                  }
                  onChange={(e) => setCustomDate(0, e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
                />
              </label>
              <label className="text-xs text-zinc-400">
                End
                <input
                  type="date"
                  value={
                    Array.isArray(value.dateRange)
                      ? (value.dateRange as [string, string])[1]
                      : ""
                  }
                  onChange={(e) => setCustomDate(1, e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
                />
              </label>
            </div>
          )}

          <div>
            <label
              htmlFor={granId}
              className="block text-xs font-medium text-zinc-400"
            >
              Granularity
            </label>
            <select
              id={granId}
              value={value.granularity ?? ""}
              onChange={(e) =>
                update({
                  granularity:
                    e.target.value === ""
                      ? undefined
                      : (e.target.value as Granularity),
                })
              }
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
            >
              {GRANULARITIES.map((g) => (
                <option key={g.id || "none"} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
