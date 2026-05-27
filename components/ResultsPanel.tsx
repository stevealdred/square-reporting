"use client";

import { useMemo, useState } from "react";
import { ResultsChart } from "./ResultsChart";
import { ResultsTable, rowsToCsv } from "./ResultsTable";
import { SummaryCards } from "./SummaryCards";
import { Pill } from "./ui/Badge";
import { buildColumnTitles } from "@/lib/columnTitles";
import {
  omitRedundantTimeColumns,
  resolveTimeColumnKey,
} from "@/lib/resultColumns";
import type {
  ApiQueryResponse,
  CubeMeta,
  ReportingQuery,
  TimeDimensionClause,
} from "@/lib/types";

type Tab = "summary" | "table" | "chart" | "json";

interface ResultsPanelProps {
  cube: CubeMeta | null;
  query: ReportingQuery;
  result: ApiQueryResponse | null;
  isRunning: boolean;
  errorMessage: string | null;
  measures: string[];
  dimensions: string[];
  timeDimension: TimeDimensionClause | null;
  onRetry: () => void;
}

export function ResultsPanel({
  cube,
  query,
  result,
  isRunning,
  errorMessage,
  measures,
  dimensions,
  timeDimension,
  onRetry,
}: ResultsPanelProps) {
  const [tab, setTab] = useState<Tab>("summary");

  const data = useMemo(
    () =>
      result && result.ok
        ? result.data
        : ([] as Array<Record<string, string | number | null>>),
    [result],
  );

  const columns = useMemo(() => {
    if (data.length === 0) return [] as string[];

    // Some rows may omit a key when the value is null/undefined. Build the
    // column set from the union of keys across every row so we never drop
    // a column just because the first row was sparse.
    const allKeys = new Set<string>();
    for (const row of data) {
      for (const k of Object.keys(row)) allKeys.add(k);
    }

    const seen = new Set<string>();
    const ordered: string[] = [];

    // Prefer a deterministic column order: time-dim → other dims → measures.
    // Always include the user's explicitly-selected members when they appear
    // anywhere in the data (Square sometimes omits a key from rows where the
    // value is null, which previously hid the column entirely).
    const timeColumn = resolveTimeColumnKey(
      [...allKeys],
      timeDimension,
    );
    if (timeColumn && allKeys.has(timeColumn)) {
      ordered.push(timeColumn);
      seen.add(timeColumn);
    }
    for (const d of dimensions) {
      if (!seen.has(d) && allKeys.has(d)) {
        ordered.push(d);
        seen.add(d);
      }
    }
    for (const m of measures) {
      if (!seen.has(m) && allKeys.has(m)) {
        ordered.push(m);
        seen.add(m);
      }
    }
    for (const k of allKeys) {
      if (!seen.has(k)) {
        ordered.push(k);
        seen.add(k);
      }
    }
    return omitRedundantTimeColumns(ordered, timeDimension);
  }, [data, dimensions, measures, timeDimension]);

  const columnTitles = useMemo(
    () =>
      buildColumnTitles(
        cube,
        columns,
        result?.ok ? result.annotation : undefined,
      ),
    [cube, columns, result],
  );

  function downloadCsv() {
    if (!data.length) return;
    const csv = rowsToCsv(data, columns, columnTitles);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `square-reporting-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const status: "idle" | "running" | "ok" | "error" = isRunning
    ? "running"
    : errorMessage
      ? "error"
      : result?.ok
        ? "ok"
        : "idle";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-100">Results</h2>
          <StatusPill
            status={status}
            attempts={result?.ok ? result.attempts : undefined}
            slow={result?.ok ? result.slowQuery : false}
            rows={result?.ok ? result.data.length : undefined}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TabButton current={tab} value="summary" onClick={() => setTab("summary")}>
            Summary
          </TabButton>
          <TabButton current={tab} value="table" onClick={() => setTab("table")}>
            Table
          </TabButton>
          <TabButton current={tab} value="chart" onClick={() => setTab("chart")}>
            Chart
          </TabButton>
          <TabButton current={tab} value="json" onClick={() => setTab("json")}>
            JSON
          </TabButton>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!data.length}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-600 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Query failed</p>
              <p className="mt-1 text-rose-300/90">{errorMessage}</p>
              {result &&
                !result.ok &&
                typeof result.detail === "object" &&
                result.detail !== null && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-rose-950/40 p-2 font-mono text-[11px] text-rose-200">
                    {JSON.stringify(result.detail, null, 2)}
                  </pre>
                )}
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-md border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/30"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {!result && !errorMessage && !isRunning && (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-12 text-center text-sm text-zinc-500">
            Configure your query on the left, then press <span className="text-amber-400">Run query</span>.
          </div>
        )}
        {isRunning && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-12 text-center text-sm text-zinc-300">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent align-middle" />
            <span className="ml-2 align-middle">Running query against Square Reporting…</span>
            <p className="mt-2 text-[11px] text-zinc-500">
              Long-running queries return <code>Continue wait</code>; we&apos;ll keep polling.
            </p>
          </div>
        )}
        {result?.ok && tab === "summary" && (
          <div className="space-y-4">
            <SummaryCards
              cube={cube}
              data={result.data}
              measureNames={measures}
            />
            {result.data.length > 0 && (
              <ResultsTable
                cube={cube}
                data={result.data.slice(0, 10)}
                columns={columns}
                columnTitles={columnTitles}
              />
            )}
            {result.data.length > 10 && (
              <p className="text-center text-xs text-zinc-500">
                Showing first 10 rows. Switch to the Table tab to see all{" "}
                {result.data.length}.
              </p>
            )}
          </div>
        )}
        {result?.ok && tab === "table" && (
          <ResultsTable
            cube={cube}
            data={result.data}
            columns={columns}
            columnTitles={columnTitles}
          />
        )}
        {result?.ok && tab === "chart" && (
          <ResultsChart
            cube={cube}
            data={result.data}
            measures={measures}
            columns={columns}
            timeDimension={timeDimension}
            columnTitles={columnTitles}
          />
        )}
        {result && tab === "json" && (
          <JsonView query={query} response={result} />
        )}
      </div>
    </div>
  );
}

function StatusPill({
  status,
  attempts,
  slow,
  rows,
}: {
  status: "idle" | "running" | "ok" | "error";
  attempts?: number;
  slow?: boolean;
  rows?: number;
}) {
  if (status === "idle") return <Pill tone="neutral">Idle</Pill>;
  if (status === "running") return <Pill tone="info">Running…</Pill>;
  if (status === "error") return <Pill tone="danger">Failed</Pill>;
  return (
    <Pill tone="success">
      {rows} rows
      {typeof attempts === "number" && attempts > 1 ? ` · ${attempts} attempts` : ""}
      {slow ? " · slow" : ""}
    </Pill>
  );
}

function TabButton({
  value,
  current,
  onClick,
  children,
}: {
  value: Tab;
  current: Tab;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-amber-500 text-zinc-950"
          : "text-zinc-300 hover:bg-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}

function JsonView({
  query,
  response,
}: {
  query: ReportingQuery;
  response: ApiQueryResponse;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Request
        </div>
        <pre className="max-h-[60vh] overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300">
          {JSON.stringify({ query }, null, 2)}
        </pre>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Response
        </div>
        <pre className="max-h-[60vh] overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300">
          {JSON.stringify(response, null, 2)}
        </pre>
      </div>
    </div>
  );
}
