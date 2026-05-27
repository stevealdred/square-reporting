"use client";

import { useId } from "react";
import type {
  CubeMeta,
  DimensionMeta,
  FilterClause,
  FilterOperator,
  MeasureMeta,
} from "@/lib/types";
import type { FilterMode } from "./QueryBuilder";
import { LocationPicker } from "./LocationPicker";
import { ChipInput } from "./ui/ChipInput";
import { isLocationIdMember } from "@/lib/locations";

interface FilterBuilderProps {
  cube: CubeMeta | null;
  filters: FilterClause[];
  mode: FilterMode;
  onChange: (next: FilterClause[]) => void;
  onModeChange: (next: FilterMode) => void;
}

interface OperatorSpec {
  id: FilterOperator;
  label: string;
  /** "none" — no value box. "single" — one text input. "multi" — chip input (multiple values OR'd within the same clause). "range" — two date inputs. */
  valueKind: "none" | "single" | "multi" | "range";
}

const OPERATORS: OperatorSpec[] = [
  { id: "equals", label: "equals", valueKind: "multi" },
  { id: "notEquals", label: "not equals", valueKind: "multi" },
  { id: "contains", label: "contains", valueKind: "multi" },
  { id: "notContains", label: "does not contain", valueKind: "multi" },
  { id: "startsWith", label: "starts with", valueKind: "multi" },
  { id: "endsWith", label: "ends with", valueKind: "multi" },
  { id: "gt", label: ">", valueKind: "single" },
  { id: "gte", label: "≥", valueKind: "single" },
  { id: "lt", label: "<", valueKind: "single" },
  { id: "lte", label: "≤", valueKind: "single" },
  { id: "inDateRange", label: "in date range", valueKind: "range" },
  { id: "notInDateRange", label: "not in date range", valueKind: "range" },
  { id: "set", label: "is set", valueKind: "none" },
  { id: "notSet", label: "is not set", valueKind: "none" },
];

const OPERATOR_BY_ID = new Map(OPERATORS.map((o) => [o.id, o]));

/**
 * Builds the optional `filters` array.
 *
 * - The AND/OR toggle controls how multiple filter rows combine. With AND we
 *   send the rows as siblings (Square's default semantics). With OR we wrap
 *   them in `[{ or: [...] }]` so Square evaluates them with OR.
 * - Each row binds a member to an operator and (if needed) a list of values.
 *   "multi" operators show a chip-style input — type a value and press Enter
 *   or comma to commit it. Multiple chips on a single row are always OR'd.
 * - "range" operators (in date range) render two date pickers.
 */
export function FilterBuilder({
  cube,
  filters,
  mode,
  onChange,
  onModeChange,
}: FilterBuilderProps) {
  const filterableMembers: Array<DimensionMeta | MeasureMeta> = cube
    ? [...cube.dimensions, ...cube.measures]
    : [];

  function addRow() {
    const first = filterableMembers[0];
    if (!first) return;
    onChange([
      ...filters,
      { member: first.name, operator: "equals", values: [] },
    ]);
  }

  function updateRow(idx: number, patch: Partial<FilterClause>) {
    const next = filters.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function removeRow(idx: number) {
    onChange(filters.filter((_, i) => i !== idx));
  }

  if (!cube) {
    return (
      <p className="text-xs text-zinc-500">Choose a source to add filters.</p>
    );
  }

  return (
    <div className="space-y-2">
      {filters.length >= 2 && (
        <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">
            Combine with
          </span>
          <div
            role="radiogroup"
            aria-label="Combine filters with"
            className="flex gap-1 rounded bg-zinc-900 p-0.5 text-xs"
          >
            {(["and", "or"] as FilterMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => onModeChange(m)}
                className={`rounded px-2 py-0.5 font-mono uppercase ${
                  mode === m
                    ? "bg-amber-500 text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {filters.length === 0 && (
        <p className="text-xs italic text-zinc-500">No filters.</p>
      )}
      {filters.map((row, idx) => (
        <div key={idx} className="space-y-1">
          {idx > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              <span className="h-px flex-1 bg-zinc-800" />
              <span>{mode}</span>
              <span className="h-px flex-1 bg-zinc-800" />
            </div>
          )}
          <FilterRow
            cube={cube}
            row={row}
            onChange={(patch) => updateRow(idx, patch)}
            onRemove={() => removeRow(idx)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="mt-1 inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900"
      >
        + Add filter
      </button>
    </div>
  );
}

function FilterRow({
  cube,
  row,
  onChange,
  onRemove,
}: {
  cube: CubeMeta;
  row: FilterClause;
  onChange: (patch: Partial<FilterClause>) => void;
  onRemove: () => void;
}) {
  const memberId = useId();
  const op = OPERATOR_BY_ID.get(row.operator) ?? OPERATORS[0];
  const dim = cube.dimensions.find((d) => d.name === row.member);
  const allowedValues = dim?.meta?.values as string[] | undefined;

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={memberId}
          aria-label="Filter member"
          value={row.member}
          onChange={(e) => onChange({ member: e.target.value, values: [] })}
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-amber-400/60 focus:outline-none"
        >
          <optgroup label="Dimensions">
            {cube.dimensions.map((d) => (
              <option key={d.name} value={d.name}>
                {d.title || d.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Measures">
            {cube.measures.map((m) => (
              <option key={m.name} value={m.name}>
                {m.title || m.name}
              </option>
            ))}
          </optgroup>
        </select>
        <select
          aria-label="Filter operator"
          value={row.operator}
          onChange={(e) => {
            const nextOp = e.target.value as FilterOperator;
            const nextSpec = OPERATOR_BY_ID.get(nextOp);
            // Reset values when changing to a kind that interprets them differently.
            const keepValues =
              nextSpec?.valueKind === op.valueKind && nextSpec?.valueKind !== "none";
            onChange({
              operator: nextOp,
              values: keepValues ? row.values : [],
            });
          }}
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-amber-400/60 focus:outline-none"
        >
          {OPERATORS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 hover:border-rose-500/40 hover:text-rose-300"
        >
          ×
        </button>
      </div>

      {op.valueKind !== "none" && (
        <div className="mt-2">
          {isLocationIdMember(row.member) && op.valueKind === "multi" ? (
            <LocationPicker
              values={row.values ?? []}
              onChange={(values) => onChange({ values })}
            />
          ) : (
            <ValueInput
              op={op}
              values={row.values ?? []}
              allowedValues={allowedValues}
              onChange={(values) => onChange({ values })}
            />
          )}
          {op.valueKind === "multi" && (
            <p className="mt-1 text-[10px] text-zinc-500">
              Multiple values on one row are combined with OR.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ValueInput({
  op,
  values,
  allowedValues,
  onChange,
}: {
  op: OperatorSpec;
  values: string[];
  allowedValues: string[] | undefined;
  onChange: (next: string[]) => void;
}) {
  if (op.valueKind === "single") {
    return (
      <input
        type="text"
        value={values[0] ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? [] : [e.target.value])}
        placeholder="Value"
        className="block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-amber-400/60 focus:outline-none"
      />
    );
  }

  if (op.valueKind === "range") {
    const start = values[0] ?? "";
    const end = values[1] ?? "";
    return (
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-zinc-500">
          Start
          <input
            type="date"
            value={start}
            onChange={(e) => onChange([e.target.value, end])}
            className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-amber-400/60 focus:outline-none"
          />
        </label>
        <label className="text-[10px] text-zinc-500">
          End
          <input
            type="date"
            value={end}
            onChange={(e) => onChange([start, e.target.value])}
            className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-amber-400/60 focus:outline-none"
          />
        </label>
      </div>
    );
  }

  // valueKind === "multi"
  if (allowedValues && allowedValues.length) {
    return (
      <select
        multiple
        value={values}
        onChange={(e) =>
          onChange(Array.from(e.target.selectedOptions).map((o) => o.value))
        }
        className="block max-h-32 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-amber-400/60 focus:outline-none"
      >
        {allowedValues.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }

  return <ChipInput values={values} onChange={onChange} />;
}
