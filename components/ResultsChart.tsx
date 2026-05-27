"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  limitCategoryChartRows,
  limitPivotSeries,
  MAX_CATEGORY_POINTS,
  MAX_CHART_SERIES,
  pivotTimeSeriesByDimension,
} from "@/lib/chartData";
import {
  compactNumber,
  formatMeasureValue,
  isCurrencyMember,
  toNumber,
} from "@/lib/format";
import { buildLocationNameMap, isLocationIdMember } from "@/lib/locations";
import {
  chartDimensionColumns,
  dataHasTimeColumn,
  resolveTimeColumnKey,
} from "@/lib/resultColumns";
import { useLocations } from "@/lib/useLocations";
import { useTheme } from "@/lib/theme";
import type {
  CubeMeta,
  ReportingLoadResponse,
  TimeDimensionClause,
} from "@/lib/types";

type ChartKind = "line" | "bar" | "area" | "pie";

interface ChartPalette {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

const DARK_PALETTE: ChartPalette = {
  grid: "#27272a",
  axis: "#71717a",
  tooltipBg: "#18181b",
  tooltipBorder: "#3f3f46",
  tooltipText: "#f4f4f5",
};

const LIGHT_PALETTE: ChartPalette = {
  grid: "#e4e4e7",
  axis: "#52525b",
  tooltipBg: "#ffffff",
  tooltipBorder: "#d4d4d8",
  tooltipText: "#18181b",
};

/** Synthetic row key when multiple dimensions are combined for the category axis. */
const CHART_CATEGORY_KEY = "__category";

interface ResultsChartProps {
  cube: CubeMeta | null;
  data: ReportingLoadResponse["data"];
  measures: string[];
  columns: string[];
  timeDimension: TimeDimensionClause | null;
  columnTitles: Record<string, string>;
}

const SERIES_COLORS = [
  "#fbbf24",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#60a5fa",
  "#facc15",
];

export function ResultsChart({
  cube,
  data,
  measures,
  columns,
  timeDimension,
  columnTitles,
}: ResultsChartProps) {
  const [theme] = useTheme();
  const palette = theme === "light" ? LIGHT_PALETTE : DARK_PALETTE;

  const timeColumnKey = useMemo(
    () => resolveTimeColumnKey(columns, timeDimension),
    [columns, timeDimension],
  );

  const timeColumn = useMemo(() => {
    if (!timeColumnKey) return null;
    if (!dataHasTimeColumn(data, timeColumnKey)) return null;
    return timeColumnKey;
  }, [timeColumnKey, data]);

  const timeRequestedButMissing = Boolean(
    timeDimension?.dimension && !timeColumn,
  );

  const dimensionColumns = useMemo(
    () =>
      chartDimensionColumns(columns, cube, timeDimension, timeColumn),
    [columns, cube, timeDimension, timeColumn],
  );

  const primaryMeasure = measures[0];

  const needsLocations = useMemo(
    () => dimensionColumns.some(isLocationIdMember),
    [dimensionColumns],
  );

  const { data: locationsData } = useLocations(needsLocations);
  const locationNames = useMemo(
    () => buildLocationNameMap(locationsData?.locations),
    [locationsData?.locations],
  );

  function formatDimensionValue(member: string, value: unknown): string {
    if (isLocationIdMember(member) && typeof value === "string") {
      return locationNames.get(value) ?? value;
    }
    return value == null ? "" : String(value);
  }

  function seriesLabelForRow(
    row: Record<string, string | number | null>,
  ): string {
    return dimensionColumns
      .map((d) => formatDimensionValue(d, row[d]))
      .filter(Boolean)
      .join(" · ");
  }

  const timePivotRaw = useMemo(() => {
    if (!timeColumn || dimensionColumns.length === 0 || !primaryMeasure) {
      return null;
    }
    return pivotTimeSeriesByDimension(
      data,
      timeColumn,
      primaryMeasure,
      seriesLabelForRow,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seriesLabelForRow uses locationNames
  }, [data, timeColumn, dimensionColumns, primaryMeasure, locationNames]);

  const seriesLimit = useMemo(() => {
    if (!timePivotRaw) return null;
    return limitPivotSeries(timePivotRaw, MAX_CHART_SERIES);
  }, [timePivotRaw]);

  const timePivot = seriesLimit?.pivot ?? null;

  const categoryDimensions = useMemo(
    () => (timeColumn ? [] : dimensionColumns),
    [timeColumn, dimensionColumns],
  );

  const xKey = useMemo(() => {
    if (timePivot) return timePivot.timeKey;
    if (timeColumn) return timeColumn;
    if (categoryDimensions.length > 1) return CHART_CATEGORY_KEY;
    if (categoryDimensions.length === 1) return categoryDimensions[0];
    return measures[0];
  }, [timePivot, timeColumn, categoryDimensions, measures]);

  const seriesLegendTitle = useMemo(() => {
    if (!dimensionColumns.length) return null;
    return dimensionColumns
      .map((d) => columnTitles[d] || d)
      .join(" · ");
  }, [dimensionColumns, columnTitles]);

  const xAxisTitle = useMemo(() => {
    if (timePivot && timeColumn) {
      return columnTitles[timeColumn] || timeColumn;
    }
    if (xKey === CHART_CATEGORY_KEY) {
      return categoryDimensions
        .map((d) => columnTitles[d] || d)
        .join(" · ");
    }
    return columnTitles[xKey] || xKey;
  }, [
    timePivot,
    timeColumn,
    xKey,
    categoryDimensions,
    columnTitles,
  ]);

  const legendSeriesKeys = timePivot?.seriesKeys ?? null;

  const defaultKind: ChartKind = useMemo(() => {
    if (timeColumn && dimensionColumns.length > 0) return "line";
    if (
      measures.length <= 1 &&
      categoryDimensions.length === 1 &&
      data.length <= MAX_CHART_SERIES
    ) {
      return "pie";
    }
    return "bar";
  }, [
    timeColumn,
    dimensionColumns.length,
    measures.length,
    categoryDimensions.length,
    data.length,
  ]);

  const [kind, setKind] = useState<ChartKind>(defaultKind);

  useEffect(() => {
    setKind(defaultKind);
  }, [defaultKind]);

  function xTickFormatter(value: unknown): string {
    if (xKey === CHART_CATEGORY_KEY) {
      return value == null ? "" : String(value);
    }
    if (timeColumn && xKey === timeColumn) {
      return value == null ? "" : String(value);
    }
    return formatDimensionValue(xKey, value);
  }

  const categoryLimit = useMemo(() => {
    if (timePivot || categoryDimensions.length === 0 || !primaryMeasure) {
      return null;
    }
    const maxPoints =
      kind === "pie" ? MAX_CHART_SERIES : MAX_CATEGORY_POINTS;
    const built = data.map((row) => {
      const r: Record<string, unknown> = { ...row };
      for (const d of categoryDimensions) {
        r[d] = formatDimensionValue(d, row[d]);
      }
      if (categoryDimensions.length > 1) {
        r[CHART_CATEGORY_KEY] = categoryDimensions
          .map((d) => r[d])
          .filter((v) => v !== "")
          .join(" · ");
      }
      for (const m of measures) {
        r[m] = toNumber(row[m]) ?? 0;
      }
      return r;
    });
    const x =
      categoryDimensions.length > 1
        ? CHART_CATEGORY_KEY
        : categoryDimensions[0];
    return limitCategoryChartRows(built, x, primaryMeasure, maxPoints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    measures,
    categoryDimensions,
    timePivot,
    primaryMeasure,
    locationNames,
    kind,
  ]);

  const chartRows = useMemo(() => {
    if (timePivot) return timePivot.rows;

    if (categoryLimit) return categoryLimit.rows;

    return data.map((row) => {
      const r: Record<string, unknown> = { ...row };
      if (timeColumn && row[timeColumn] != null) {
        const v = row[timeColumn];
        if (typeof v === "string" && v.length >= 10) {
          r[timeColumn] = v.slice(0, 10);
        }
      }
      for (const m of measures) {
        r[m] = toNumber(row[m]) ?? 0;
      }
      return r;
    });
  }, [data, measures, timeColumn, timePivot, categoryLimit]);

  const lineDataKeys = useMemo(() => {
    if (timePivot) return timePivot.seriesKeys;
    return measures;
  }, [timePivot, measures]);

  function lineDisplayName(key: string): string {
    if (timePivot) return key;
    const measure = cube?.measures.find((m) => m.name === key);
    return measure?.title || key;
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
        No rows to chart.
      </div>
    );
  }

  if (measures.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
        Add at least one measure to draw a chart.
      </div>
    );
  }

  if (
    timeColumn &&
    dimensionColumns.length > 0 &&
    !timePivot?.seriesKeys.length
  ) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500">
        No dimension values found in the result rows to label the chart series.
      </div>
    );
  }

  function tickFormatter(value: unknown) {
    return compactNumber(value);
  }

  function tooltipFormatter(value: unknown, name: string) {
    if (timePivot) {
      return [formatMeasureValue(value, cube?.measures.find((m) => m.name === primaryMeasure)), name];
    }
    const measure = cube?.measures.find((m) => m.name === name);
    return [formatMeasureValue(value, measure), measure?.title || name];
  }

  const tooltipContentStyle = {
    backgroundColor: palette.tooltipBg,
    border: `1px solid ${palette.tooltipBorder}`,
    borderRadius: 8,
    color: palette.tooltipText,
    fontSize: 12,
  } as const;

  const tickStyle = { fill: palette.axis, fontSize: 11 };

  const xAxisCommon = {
    dataKey: xKey,
    stroke: palette.axis,
    tick: tickStyle,
    tickMargin: 8,
    tickFormatter: xTickFormatter,
    interval: 0 as const,
    angle:
      !timePivot && categoryDimensions.length > 0 && chartRows.length > 8
        ? -35
        : 0,
    textAnchor:
      !timePivot && categoryDimensions.length > 0 && chartRows.length > 8
        ? ("end" as const)
        : ("middle" as const),
    height:
      !timePivot && categoryDimensions.length > 0 && chartRows.length > 8
        ? 72
        : 48,
    label: {
      value: xAxisTitle,
      position: "insideBottom" as const,
      offset: -2,
      style: { fill: palette.axis, fontSize: 11 },
    },
  };

  function pieSliceLabel(props: {
    name?: string | number;
    payload?: Record<string, unknown>;
    x?: number;
    y?: number;
    textAnchor?: string;
    [key: string]: unknown;
  }) {
    const raw =
      props.payload && xKey in props.payload
        ? props.payload[xKey]
        : props.name;
    const text = xTickFormatter(raw);
    if (!text) return null;
    const display = text.length > 24 ? `${text.slice(0, 22)}…` : text;
    const { x, y, textAnchor } = props;
    return (
      <text
        x={x}
        y={y}
        textAnchor={
          textAnchor as "start" | "middle" | "end" | "inherit" | undefined
        }
        fill={palette.tooltipText}
        fontSize={11}
      >
        {display}
      </text>
    );
  }

  const chartMargin = {
    top: 8,
    right: 16,
    bottom:
      !timePivot && categoryDimensions.length > 0 && chartRows.length > 8
        ? 56
        : 40,
    left: 8,
  };

  const showCategoryHint =
    dimensionColumns.length > 0 || categoryDimensions.length > 0;

  const measureTitle =
    columnTitles[primaryMeasure] || primaryMeasure;

  const seriesCapHint =
    seriesLimit && seriesLimit.omittedSeries > 0
      ? {
          shown: seriesLimit.shownSeries.length,
          total: seriesLimit.totalSeries,
          includesOther: seriesLimit.includesOther,
        }
      : null;

  const categoryCapHint =
    categoryLimit && categoryLimit.omitted > 0
      ? {
          shown: categoryLimit.shown,
          total: categoryLimit.total,
          includesOther: categoryLimit.includesOther,
        }
      : null;

  function renderSeries(
    Component: typeof Line | typeof Bar | typeof Area,
    extraProps: Record<string, unknown> = {},
  ) {
    return lineDataKeys.map((key, i) => {
      const color = SERIES_COLORS[i % SERIES_COLORS.length];
      const common = {
        dataKey: key,
        name: lineDisplayName(key),
        stroke: color,
        fill: color,
        strokeWidth: 2,
        ...extraProps,
      };
      if (Component === Line) {
        return <Line key={key} {...common} type="monotone" dot={false} />;
      }
      if (Component === Bar) {
        return <Bar key={key} {...common} radius={[4, 4, 0, 0]} />;
      }
      return (
        <Area
          key={key}
          {...common}
          type="monotone"
          fillOpacity={0.2}
        />
      );
    });
  }

  const pieDisabled = measures.length !== 1 || !!timePivot;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      {timeRequestedButMissing && (
        <p className="mb-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          A time dimension is selected in the query, but the API response does not
          include a time column (only{" "}
          {dimensionColumns.map((d) => columnTitles[d] || d).join(", ")}). The
          chart is grouped by dimension instead.
        </p>
      )}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">Chart</h3>
        <div className="flex gap-1 rounded-md bg-zinc-900 p-1 text-xs">
          {(["line", "bar", "area", "pie"] as ChartKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              disabled={k === "pie" && pieDisabled}
              className={`rounded px-2 py-1 capitalize transition-colors ${
                kind === k
                  ? "bg-amber-500 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-zinc-400"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "line" ? (
            <LineChart data={chartRows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
              <XAxis {...xAxisCommon} />
              <YAxis stroke={palette.axis} tick={tickStyle} tickFormatter={tickFormatter} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                formatter={tooltipFormatter}
                labelFormatter={(label) =>
                  timePivot
                    ? `${columnTitles[timeColumn!] || "Date"}: ${label}`
                    : xTickFormatter(label)
                }
              />
              <Legend
                wrapperStyle={{
                  fontSize: 12,
                  color: palette.tooltipText,
                  maxHeight: 96,
                  overflowY: "auto",
                }}
              />
              {renderSeries(Line)}
            </LineChart>
          ) : kind === "bar" ? (
            <BarChart data={chartRows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
              <XAxis {...xAxisCommon} />
              <YAxis stroke={palette.axis} tick={tickStyle} tickFormatter={tickFormatter} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                formatter={tooltipFormatter}
                labelFormatter={(label) =>
                  timePivot
                    ? `${columnTitles[timeColumn!] || "Date"}: ${label}`
                    : xTickFormatter(label)
                }
              />
              <Legend
                wrapperStyle={{
                  fontSize: 12,
                  color: palette.tooltipText,
                  maxHeight: 96,
                  overflowY: "auto",
                }}
              />
              {renderSeries(Bar)}
            </BarChart>
          ) : kind === "area" ? (
            <AreaChart data={chartRows} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
              <XAxis {...xAxisCommon} />
              <YAxis stroke={palette.axis} tick={tickStyle} tickFormatter={tickFormatter} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                formatter={tooltipFormatter}
                labelFormatter={(label) =>
                  timePivot
                    ? `${columnTitles[timeColumn!] || "Date"}: ${label}`
                    : xTickFormatter(label)
                }
              />
              <Legend
                wrapperStyle={{
                  fontSize: 12,
                  color: palette.tooltipText,
                  maxHeight: 96,
                  overflowY: "auto",
                }}
              />
              {renderSeries(Area)}
            </AreaChart>
          ) : (
            <PieChart>
              <Tooltip
                contentStyle={tooltipContentStyle}
                formatter={tooltipFormatter}
                labelFormatter={xTickFormatter}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: palette.tooltipText }} />
              <Pie
                data={chartRows}
                dataKey={measures[0]}
                nameKey={xKey}
                outerRadius={110}
                innerRadius={50}
                paddingAngle={2}
                label={pieSliceLabel}
                labelLine={{ stroke: palette.axis }}
              >
                {chartRows.map((_, i) => (
                  <Cell
                    key={i}
                    fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
      {seriesCapHint && (
        <p className="mt-2 text-[11px] text-amber-200/80">
          Showing the top {seriesCapHint.shown} of {seriesCapHint.total}{" "}
          {seriesLegendTitle || "items"} by {measureTitle}
          {seriesCapHint.includesOther ? " (plus Other)" : ""}. Filter{" "}
          {seriesLegendTitle || "the dimension"} in the query to compare specific
          items.
        </p>
      )}
      {categoryCapHint && (
        <p className="mt-2 text-[11px] text-amber-200/80">
          Showing the top {categoryCapHint.shown} of {categoryCapHint.total}{" "}
          categories by {measureTitle}
          {categoryCapHint.includesOther ? " (plus Other)" : ""}.
        </p>
      )}
      {showCategoryHint && (
        <p className="mt-2 text-[11px] text-zinc-500">
          {timePivot && legendSeriesKeys ? (
            <>
              <span className="text-zinc-400">X-axis:</span> {xAxisTitle}.{" "}
              <span className="text-zinc-400">Legend:</span>{" "}
              {seriesLegendTitle || "series"} (
              {seriesCapHint
                ? `${seriesCapHint.shown} of ${seriesCapHint.total}`
                : legendSeriesKeys.length}{" "}
              {seriesCapHint?.total === 1 ? "item" : "items"}).
            </>
          ) : (
            <>
              <span className="text-zinc-400">{xAxisTitle}:</span>{" "}
              {measures.length > 1
                ? "each measure is a separate color."
                : "each bar or slice is one row from the result set."}
            </>
          )}
          {!isCurrencyMember(measures[0], cube?.measures || []) && null}
        </p>
      )}
    </div>
  );
}
