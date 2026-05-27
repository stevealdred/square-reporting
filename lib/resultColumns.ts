import { isMeasureMember } from "./format";
import type { CubeMeta, TimeDimensionClause } from "./types";

/** Resolve the time column key as it appears in result rows (granularity suffix may vary). */
export function resolveTimeColumnKey(
  columns: string[],
  timeDimension: TimeDimensionClause | null,
): string | null {
  if (!timeDimension?.dimension) return null;

  const withGranularity = timeDimension.granularity
    ? `${timeDimension.dimension}.${timeDimension.granularity}`
    : null;

  if (withGranularity && columns.includes(withGranularity)) {
    return withGranularity;
  }
  if (columns.includes(timeDimension.dimension)) {
    return timeDimension.dimension;
  }

  const prefix = `${timeDimension.dimension}.`;
  const prefixed = columns.find((c) => c.startsWith(prefix));
  if (prefixed) return prefixed;

  // Query may include a time dimension but Square omits it from rows (e.g. limit
  // without time in the result). Never invent a column key that isn't in the data.
  return null;
}

/**
 * Square often returns both `Cube.time` and `Cube.time.day` when granularity is
 * set. Keep the granular column and drop the redundant base timestamp column.
 */
export function omitRedundantTimeColumns(
  columns: string[],
  timeDimension: TimeDimensionClause | null,
): string[] {
  if (!timeDimension?.granularity) return columns;
  const granular = `${timeDimension.dimension}.${timeDimension.granularity}`;
  if (!columns.includes(granular)) return columns;
  return columns.filter((c) => c !== timeDimension.dimension);
}

/** True when at least one row carries a non-empty value for the time column. */
export function dataHasTimeColumn(
  data: Array<Record<string, string | number | null>>,
  timeColumn: string,
): boolean {
  return data.some((row) => {
    const v = row[timeColumn];
    return v != null && v !== "";
  });
}

export function isTimeResultColumn(
  column: string,
  timeDimension: TimeDimensionClause | null,
  timeColumn: string | null,
): boolean {
  if (!timeDimension) return false;
  if (timeColumn && column === timeColumn) return true;
  if (column === timeDimension.dimension) return true;
  return column.startsWith(`${timeDimension.dimension}.`);
}

/** Non-measure, non-time columns present in the result set — used for chart categories / series. */
export function chartDimensionColumns(
  columns: string[],
  cube: CubeMeta | null,
  timeDimension: TimeDimensionClause | null,
  timeColumn: string | null,
): string[] {
  return columns.filter((col) => {
    if (isTimeResultColumn(col, timeDimension, timeColumn)) return false;
    if (cube && isMeasureMember(col, cube.measures)) return false;
    return true;
  });
}
