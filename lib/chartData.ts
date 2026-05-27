import { toNumber } from "./format";

/** Max dimension values drawn as separate lines/bars/legend entries. */
export const MAX_CHART_SERIES = 12;

/** Max categories on a bar/pie chart when there is no time breakdown. */
export const MAX_CATEGORY_POINTS = 20;

const OTHER_SERIES_LABEL = "Other (remaining items)";

export interface TimeSeriesPivot {
  rows: Array<Record<string, unknown>>;
  /** Display names for each `<Line dataKey={…} />` / legend entry. */
  seriesKeys: string[];
  timeKey: string;
}

export interface SeriesLimitResult {
  pivot: TimeSeriesPivot;
  shownSeries: string[];
  totalSeries: number;
  omittedSeries: number;
  includesOther: boolean;
}

export interface CategoryLimitResult {
  rows: Array<Record<string, unknown>>;
  shown: number;
  total: number;
  omitted: number;
  includesOther: boolean;
  xKey: string;
}

/**
 * Pivot long-format reporting rows into wide format: one column per series
 * (dimension value) so Recharts can render multiple lines/bars over time.
 */
export function pivotTimeSeriesByDimension(
  data: Array<Record<string, string | number | null>>,
  timeKey: string,
  measureKey: string,
  seriesLabelForRow: (row: Record<string, string | number | null>) => string,
): TimeSeriesPivot {
  const seriesSet = new Set<string>();
  const byTime = new Map<string, Record<string, unknown>>();

  for (const row of data) {
    const rawTime = row[timeKey];
    if (rawTime == null || rawTime === "") continue;

    const timeLabel =
      typeof rawTime === "string" && rawTime.length >= 10
        ? rawTime.slice(0, 10)
        : String(rawTime);

    const seriesLabel = seriesLabelForRow(row);
    if (!seriesLabel) continue;

    seriesSet.add(seriesLabel);

    let bucket = byTime.get(timeLabel);
    if (!bucket) {
      bucket = { [timeKey]: timeLabel };
      byTime.set(timeLabel, bucket);
    }
    const value = toNumber(row[measureKey]) ?? 0;
    const prev = toNumber(bucket[seriesLabel]);
    bucket[seriesLabel] = prev == null ? value : prev + value;
  }

  const rows = [...byTime.values()].sort((a, b) =>
    String(a[timeKey] ?? "").localeCompare(String(b[timeKey] ?? "")),
  );

  return {
    rows,
    seriesKeys: [...seriesSet].sort((a, b) => a.localeCompare(b)),
    timeKey,
  };
}

function rankSeriesByTotal(
  rows: Array<Record<string, unknown>>,
  seriesKeys: string[],
): Array<{ key: string; total: number }> {
  return seriesKeys
    .map((key) => ({
      key,
      total: rows.reduce((sum, row) => sum + (toNumber(row[key]) ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Keep the top N series by total measure; roll the rest into "Other". */
export function limitPivotSeries(
  pivot: TimeSeriesPivot,
  maxSeries: number = MAX_CHART_SERIES,
): SeriesLimitResult {
  const totalSeries = pivot.seriesKeys.length;
  if (totalSeries <= maxSeries) {
    return {
      pivot,
      shownSeries: pivot.seriesKeys,
      totalSeries,
      omittedSeries: 0,
      includesOther: false,
    };
  }

  const ranked = rankSeriesByTotal(pivot.rows, pivot.seriesKeys);
  const kept = ranked.slice(0, maxSeries);
  const dropped = ranked.slice(maxSeries);
  const keptKeys = kept.map((r) => r.key);

  const rows = pivot.rows.map((row) => {
    const next: Record<string, unknown> = { [pivot.timeKey]: row[pivot.timeKey] };
    for (const { key } of kept) {
      next[key] = row[key] ?? 0;
    }
    next[OTHER_SERIES_LABEL] = dropped.reduce(
      (sum, { key }) => sum + (toNumber(row[key]) ?? 0),
      0,
    );
    return next;
  });

  return {
    pivot: {
      rows,
      seriesKeys: [...keptKeys, OTHER_SERIES_LABEL],
      timeKey: pivot.timeKey,
    },
    shownSeries: keptKeys,
    totalSeries,
    omittedSeries: dropped.length,
    includesOther: true,
  };
}

/** Keep the top N category rows by measure; optionally roll the rest into Other. */
export function limitCategoryChartRows(
  rows: Array<Record<string, unknown>>,
  xKey: string,
  measureKey: string,
  maxPoints: number = MAX_CATEGORY_POINTS,
): CategoryLimitResult {
  const total = rows.length;
  if (total <= maxPoints) {
    return {
      rows,
      shown: total,
      total,
      omitted: 0,
      includesOther: false,
      xKey,
    };
  }

  const sorted = [...rows].sort(
    (a, b) => (toNumber(b[measureKey]) ?? 0) - (toNumber(a[measureKey]) ?? 0),
  );
  const kept = sorted.slice(0, maxPoints);
  const dropped = sorted.slice(maxPoints);
  const otherValue = dropped.reduce(
    (sum, row) => sum + (toNumber(row[measureKey]) ?? 0),
    0,
  );

  const otherRow: Record<string, unknown> = {
    [xKey]: OTHER_SERIES_LABEL,
    [measureKey]: otherValue,
  };

  return {
    rows: [...kept, otherRow],
    shown: maxPoints,
    total,
    omitted: dropped.length,
    includesOther: true,
    xKey,
  };
}
