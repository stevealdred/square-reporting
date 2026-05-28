"use client";

import { useMemo } from "react";
import { CubePicker } from "./CubePicker";
import { MeasureSelector } from "./MeasureSelector";
import { DimensionSelector } from "./DimensionSelector";
import { TimeDimensionEditor } from "./TimeDimensionEditor";
import { SegmentSelector } from "./SegmentSelector";
import { FilterBuilder } from "./FilterBuilder";
import { OrderLimitControls } from "./OrderLimitControls";
import { QueryJsonPreview } from "./QueryJsonPreview";
import { Section } from "./ui/Section";
import { Pill } from "./ui/Badge";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ui/ThemeToggle";
import type {
  CubeMeta,
  FilterClause,
  OrderClause,
  ReportingMeta,
  ReportingQuery,
  TimeDimensionClause,
} from "@/lib/types";
import { assembleFilters, orderClauseToTuples, pruneQuery } from "@/lib/queryShape";

export type FilterMode = "and" | "or";

export interface BuilderState {
  cube: string | null;
  measures: string[];
  dimensions: string[];
  timeDimension: TimeDimensionClause | null;
  segments: string[];
  filters: FilterClause[];
  filterMode: FilterMode;
  order: OrderClause | null;
  limit: number;
  offset: number;
}

interface QueryBuilderProps {
  meta: ReportingMeta;
  state: BuilderState;
  onChange: (next: BuilderState) => void;
  onRun: () => void;
  isRunning: boolean;
  showSignOut?: boolean;
}

export function buildQuery(state: BuilderState): ReportingQuery {
  const q: ReportingQuery = {};
  if (state.measures.length) q.measures = state.measures;
  if (state.dimensions.length) q.dimensions = state.dimensions;
  if (state.timeDimension && state.timeDimension.dimension) {
    q.timeDimensions = [state.timeDimension];
  }
  if (state.segments.length) q.segments = state.segments;
  const assembled = assembleFilters(state.filters, state.filterMode);
  if (assembled.length) q.filters = assembled;
  if (state.order) q.order = orderClauseToTuples(state.order);
  if (state.limit) q.limit = state.limit;
  if (state.offset) q.offset = state.offset;
  return pruneQuery(q);
}

export function QueryBuilder({
  meta,
  state,
  onChange,
  onRun,
  isRunning,
  showSignOut = false,
}: QueryBuilderProps) {
  const cube: CubeMeta | null = useMemo(
    () => meta.cubes.find((c) => c.name === state.cube) ?? null,
    [meta, state.cube],
  );

  const query = useMemo(() => buildQuery(state), [state]);

  function update<K extends keyof BuilderState>(key: K, value: BuilderState[K]) {
    onChange({ ...state, [key]: value });
  }

  function setCube(name: string) {
    if (name === state.cube) return;
    onChange({
      cube: name,
      measures: [],
      dimensions: [],
      timeDimension: null,
      segments: [],
      filters: [],
      filterMode: "and",
      order: null,
      limit: state.limit,
      offset: 0,
    });
  }

  const orderableMembers = useMemo(() => {
    if (!cube) return [];
    const out: Array<{ name: string; title?: string }> = [];
    for (const name of state.measures) {
      const m = cube.measures.find((x) => x.name === name);
      out.push({ name, title: m?.title });
    }
    for (const name of state.dimensions) {
      const d = cube.dimensions.find((x) => x.name === name);
      out.push({ name, title: d?.title });
    }
    if (state.timeDimension?.dimension) {
      const d = cube.dimensions.find(
        (x) => x.name === state.timeDimension!.dimension,
      );
      out.push({
        name: state.timeDimension.dimension,
        title: d?.title,
      });
    }
    return out;
  }, [cube, state.measures, state.dimensions, state.timeDimension]);

  const canRun =
    !!cube &&
    (state.measures.length > 0 ||
      state.dimensions.length > 0 ||
      !!state.timeDimension);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-1 border-b border-zinc-800 px-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-zinc-100">Report builder</h1>
          <div className="flex shrink-0 items-center gap-2">
            {cube && (
              <Pill tone={cube.type === "view" ? "success" : "info"}>
                {cube.type === "view" ? "View" : "Cube"}
              </Pill>
            )}
            {showSignOut ? <SignOutButton /> : null}
            <ThemeToggle />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Pick a source, then add measures and dimensions. Run to see results.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        <Section title="Source" defaultOpen>
          <CubePicker
            cubes={meta.cubes}
            value={state.cube}
            onChange={setCube}
          />
        </Section>

        <Section
          title="Measures"
          description={
            cube ? `${cube.measures.length} available` : "Pick a source first."
          }
          defaultOpen
          badge={state.measures.length ? <Pill tone="info">{state.measures.length}</Pill> : null}
        >
          {cube ? (
            <MeasureSelector
              measures={cube.measures}
              value={state.measures}
              onChange={(next) => update("measures", next)}
            />
          ) : (
            <p className="text-xs text-zinc-500">Select a source to see measures.</p>
          )}
        </Section>

        <Section
          title="Dimensions"
          description={
            cube
              ? `${cube.dimensions.filter((d) => d.type !== "time").length} available (time dimensions appear in the next section)`
              : "Pick a source first."
          }
          badge={
            state.dimensions.length ? (
              <Pill tone="info">{state.dimensions.length}</Pill>
            ) : null
          }
        >
          {cube ? (
            <DimensionSelector
              dimensions={cube.dimensions}
              value={state.dimensions}
              onChange={(next) => update("dimensions", next)}
            />
          ) : (
            <p className="text-xs text-zinc-500">Select a source.</p>
          )}
        </Section>

        <Section
          title="Time"
          description="Define a time-series breakdown by date range and granularity."
          badge={
            state.timeDimension?.dimension ? <Pill tone="info">on</Pill> : null
          }
        >
          {cube ? (
            <TimeDimensionEditor
              dimensions={cube.dimensions}
              value={state.timeDimension}
              onChange={(next) => update("timeDimension", next)}
            />
          ) : (
            <p className="text-xs text-zinc-500">Select a source.</p>
          )}
        </Section>

        <Section
          title="Segments"
          description="Predefined business-logic filters."
          badge={
            state.segments.length ? <Pill tone="info">{state.segments.length}</Pill> : null
          }
          defaultOpen={false}
        >
          {cube ? (
            cube.segments.length ? (
              <SegmentSelector
                segments={cube.segments}
                value={state.segments}
                onChange={(next) => update("segments", next)}
              />
            ) : (
              <p className="text-xs text-zinc-500">No segments defined for this source.</p>
            )
          ) : (
            <p className="text-xs text-zinc-500">Select a source.</p>
          )}
        </Section>

        <Section
          title="Filters"
          description="Custom filtering on dimensions and measures."
          badge={
            state.filters.length ? <Pill tone="info">{state.filters.length}</Pill> : null
          }
          defaultOpen={false}
        >
          <FilterBuilder
            cube={cube}
            filters={state.filters}
            mode={state.filterMode}
            onChange={(next) => update("filters", next)}
            onModeChange={(next) => update("filterMode", next)}
          />
        </Section>

        <Section
          title="Order & Limit"
          description="Sort results and cap row count."
          defaultOpen={false}
        >
          <OrderLimitControls
            orderableMembers={orderableMembers}
            order={state.order}
            limit={state.limit}
            offset={state.offset}
            onOrderChange={(next) => update("order", next)}
            onLimitChange={(next) => update("limit", next)}
            onOffsetChange={(next) => update("offset", next)}
          />
        </Section>

        <Section title="Request preview" defaultOpen={false}>
          <QueryJsonPreview query={query} />
        </Section>
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={!canRun || isRunning}
        className="sticky bottom-0 mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/10 transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500 disabled:shadow-none"
      >
        {isRunning ? (
          <>
            <span
              aria-hidden
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent"
            />
            Running…
          </>
        ) : (
          <>Run query</>
        )}
      </button>
    </div>
  );
}
