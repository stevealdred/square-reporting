import type { CubeMeta, ReportingLoadResponse } from "./types";

type ResultAnnotation = ReportingLoadResponse["annotation"];

/** Human-readable headers for result columns (table, chart axes, tooltips). */
export function buildColumnTitles(
  cube: CubeMeta | null,
  columns: string[],
  annotation?: ResultAnnotation,
): Record<string, string> {
  const titles: Record<string, string> = {};

  for (const col of columns) {
    const annotatedMeasure = annotation?.measures?.[col];
    if (annotatedMeasure?.title || annotatedMeasure?.shortTitle) {
      titles[col] =
        annotatedMeasure.shortTitle || annotatedMeasure.title || col;
      continue;
    }
    const annotatedDim = annotation?.dimensions?.[col];
    if (annotatedDim?.title || annotatedDim?.shortTitle) {
      titles[col] = annotatedDim.shortTitle || annotatedDim.title || col;
      continue;
    }
    const annotatedTime = annotation?.timeDimensions?.[col];
    if (annotatedTime?.title || annotatedTime?.shortTitle) {
      titles[col] = annotatedTime.shortTitle || annotatedTime.title || col;
      continue;
    }

    if (!cube) {
      titles[col] = col;
      continue;
    }

    const measure = cube.measures.find((m) => m.name === col);
    if (measure) {
      titles[col] = measure.title || measure.name;
      continue;
    }
    const lastDot = col.lastIndexOf(".");
    const baseDim = col.split(".").slice(0, 2).join(".");
    const dim = cube.dimensions.find((d) => d.name === baseDim);
    if (dim) {
      const granularity =
        col === baseDim ? "" : col.slice(lastDot + 1).replace("_", " ");
      titles[col] = granularity
        ? `${dim.title || dim.name} (${granularity})`
        : dim.title || dim.name;
      continue;
    }
    titles[col] = col;
  }
  return titles;
}
