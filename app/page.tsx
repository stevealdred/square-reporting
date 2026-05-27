"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  buildQuery,
  QueryBuilder,
  type BuilderState,
} from "@/components/QueryBuilder";
import { ResultsPanel } from "@/components/ResultsPanel";
import type {
  ApiQueryResponse,
  CubeMeta,
  ReportingMeta,
} from "@/lib/types";

interface MetaApiResponse {
  ok: boolean;
  meta?: ReportingMeta;
  error?: string;
  cached?: boolean;
  fetchedAt?: number;
}

const fetcher = async (url: string): Promise<MetaApiResponse> => {
  const res = await fetch(url, { method: "GET" });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = { ok: false, error: `Invalid response (HTTP ${res.status})` };
  }
  return json as MetaApiResponse;
};

const INITIAL_STATE: BuilderState = {
  cube: null,
  measures: [],
  dimensions: [],
  timeDimension: null,
  segments: [],
  filters: [],
  filterMode: "and",
  order: null,
  limit: 1000,
  offset: 0,
};

export default function ReportingPage() {
  const { data: metaResponse, error: metaError, isLoading, mutate } = useSWR<
    MetaApiResponse
  >("/api/meta", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  const meta = metaResponse?.ok ? metaResponse.meta : undefined;

  const [state, setState] = useState<BuilderState>(INITIAL_STATE);
  const [result, setResult] = useState<ApiQueryResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  /**
   * When metadata first arrives, default to the `Sales` view (or the first
   * available view) plus a sensible starter query.
   */
  useEffect(() => {
    if (!meta || state.cube) return;
    const cubes = meta.cubes;
    const sales =
      cubes.find((c) => c.name === "Sales") ||
      cubes.find((c) => c.type === "view") ||
      cubes[0];
    if (!sales) return;
    setState((prev) => seedFromCube(prev, sales));
  }, [meta, state.cube]);

  const cube = useMemo<CubeMeta | null>(
    () => meta?.cubes.find((c) => c.name === state.cube) ?? null,
    [meta, state.cube],
  );

  const query = useMemo(() => buildQuery(state), [state]);

  async function runQuery() {
    if (!cube) return;
    setIsRunning(true);
    setErrorMessage(null);
    setResult(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      let json: ApiQueryResponse;
      try {
        json = (await res.json()) as ApiQueryResponse;
      } catch {
        json = {
          ok: false,
          status: res.status,
          error: `Invalid response (HTTP ${res.status})`,
        };
      }
      setResult(json);
      if (!json.ok) setErrorMessage(json.error);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setErrorMessage(message);
      setResult({ ok: false, status: 0, error: message });
    } finally {
      setIsRunning(false);
    }
  }

  if (isLoading) {
    return <FullPageStatus title="Loading schema…" subtitle="Fetching cubes and measures from /v1/meta." />;
  }

  if (metaError || (metaResponse && !metaResponse.ok)) {
    const detail = metaError instanceof Error
      ? metaError.message
      : metaResponse?.error || "Could not load schema.";
    return (
      <FullPageStatus
        tone="error"
        title="Could not connect to Square Reporting"
        subtitle={detail}
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => mutate()}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
            >
              Try again
            </button>
            <a
              href="https://developer.squareup.com/docs/reporting-api/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-600"
            >
              Setup docs
            </a>
          </div>
        }
        helpBox={
          <ol className="mt-4 list-decimal space-y-1 pl-6 text-left text-xs text-zinc-400">
            <li>Set <code className="font-mono">SQUARE_ACCESS_TOKEN</code> in <code className="font-mono">.env.local</code>.</li>
            <li>Confirm the token has the <code className="font-mono">REPORTING_READ</code> scope.</li>
            <li>Restart the dev server (env vars are read at boot).</li>
          </ol>
        }
      />
    );
  }

  if (!meta) return null;

  return (
    <main className="grid h-screen grid-cols-1 gap-0 lg:grid-cols-[420px_minmax(0,1fr)]">
      <aside className="flex h-screen flex-col border-r border-zinc-800 bg-zinc-950 p-4 lg:overflow-hidden">
        <QueryBuilder
          meta={meta}
          state={state}
          onChange={setState}
          onRun={runQuery}
          isRunning={isRunning}
        />
      </aside>
      <section className="h-screen overflow-y-auto bg-zinc-950 p-6">
        <ResultsPanel
          cube={cube}
          query={query}
          result={result}
          isRunning={isRunning}
          errorMessage={errorMessage}
          measures={state.measures}
          dimensions={state.dimensions}
          timeDimension={state.timeDimension}
          onRetry={runQuery}
        />
      </section>
    </main>
  );
}

function seedFromCube(prev: BuilderState, cube: CubeMeta): BuilderState {
  const next: BuilderState = {
    ...prev,
    cube: cube.name,
    measures: [],
    dimensions: [],
    timeDimension: null,
    segments: [],
    filters: [],
    filterMode: "and",
    order: null,
    offset: 0,
  };
  // Pick the first sensible measure (`net_sales` if present, else first).
  const preferredMeasure =
    cube.measures.find((m) => /net_sales/i.test(m.name)) || cube.measures[0];
  if (preferredMeasure) next.measures = [preferredMeasure.name];
  // Pick a time dimension if available (prefer "local_reporting_timestamp" / "local_date").
  const timeDim =
    cube.dimensions.find((d) => /local_reporting_timestamp/i.test(d.name)) ||
    cube.dimensions.find((d) => /local_date/i.test(d.name)) ||
    cube.dimensions.find((d) => d.type === "time");
  if (timeDim) {
    next.timeDimension = {
      dimension: timeDim.name,
      dateRange: "last 30 days",
      granularity: "day",
    };
  }
  return next;
}

function FullPageStatus({
  title,
  subtitle,
  tone = "info",
  action,
  helpBox,
}: {
  title: string;
  subtitle?: string;
  tone?: "info" | "error";
  action?: React.ReactNode;
  helpBox?: React.ReactNode;
}) {
  const accent =
    tone === "error" ? "border-rose-500/30 text-rose-200" : "border-amber-500/20";
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div
        className={`w-full max-w-xl rounded-2xl border ${accent} bg-zinc-900/40 p-8 text-center shadow-2xl shadow-black/40`}
      >
        <h1 className="text-2xl font-semibold text-zinc-100">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
        )}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
        {helpBox}
      </div>
    </main>
  );
}
