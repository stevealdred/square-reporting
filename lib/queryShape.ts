import { z } from "zod";
import type {
  CubeMeta,
  FilterArrayItem,
  FilterClause,
  OrderClause,
  OrderDirection,
  OrderTuple,
  ReportingQuery,
  TimeDimensionClause,
} from "./types";

const memberRegex = /^[A-Za-z][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/;
const memberSchema = z.string().regex(memberRegex, "Invalid member format");

const granularitySchema = z.enum([
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);

const dateRangeSchema = z.union([
  z.string().min(1),
  z.tuple([z.string().min(1), z.string().min(1)]),
]);

const timeDimensionSchema = z.object({
  dimension: memberSchema,
  dateRange: dateRangeSchema.optional(),
  granularity: granularitySchema.optional(),
});

const filterSchema = z.object({
  member: memberSchema,
  operator: z.enum([
    "equals",
    "notEquals",
    "contains",
    "notContains",
    "startsWith",
    "endsWith",
    "gt",
    "gte",
    "lt",
    "lte",
    "inDateRange",
    "notInDateRange",
    "set",
    "notSet",
  ]),
  values: z.array(z.string()).optional(),
});

const booleanGroupSchema = z.union([
  z.object({ or: z.array(filterSchema).min(1) }).strict(),
  z.object({ and: z.array(filterSchema).min(1) }).strict(),
]);

const filterArrayItemSchema = z.union([filterSchema, booleanGroupSchema]);

export const reportingQuerySchema = z
  .object({
    measures: z.array(memberSchema).optional(),
    dimensions: z.array(memberSchema).optional(),
    timeDimensions: z.array(timeDimensionSchema).optional(),
    segments: z.array(memberSchema).optional(),
    filters: z.array(filterArrayItemSchema).optional(),
    order: z
      .union([
        z.array(z.tuple([memberSchema, z.enum(["asc", "desc"])])),
        z
          .record(memberSchema, z.enum(["asc", "desc"]))
          .transform((obj) =>
            Object.entries(obj).map(
              ([member, dir]) => [member, dir] as OrderTuple,
            ),
          ),
      ])
      .optional(),
    limit: z.number().int().positive().max(50000).optional(),
    offset: z.number().int().nonnegative().optional(),
    timezone: z.string().optional(),
  })
  .refine(
    (q) =>
      (q.measures && q.measures.length > 0) ||
      (q.dimensions && q.dimensions.length > 0) ||
      (q.timeDimensions && q.timeDimensions.length > 0),
    {
      message: "Query must include at least one measure, dimension, or time dimension.",
    },
  );

export type ParsedReportingQuery = z.infer<typeof reportingQuerySchema>;

/** Strip empty arrays / undefineds so the JSON we send is minimal & readable. */
export function pruneQuery(query: ReportingQuery): ReportingQuery {
  const out: ReportingQuery = {};
  if (query.measures && query.measures.length) out.measures = query.measures;
  if (query.dimensions && query.dimensions.length) out.dimensions = query.dimensions;
  if (query.timeDimensions && query.timeDimensions.length) {
    out.timeDimensions = query.timeDimensions
      .filter((td) => !!td.dimension)
      .map((td) => {
        const clause: TimeDimensionClause = { dimension: td.dimension };
        if (td.dateRange) clause.dateRange = td.dateRange;
        if (td.granularity) clause.granularity = td.granularity;
        return clause;
      });
  }
  if (query.segments && query.segments.length) out.segments = query.segments;
  if (query.filters && query.filters.length) {
    const cleaned = query.filters
      .map(cleanFilterItem)
      .filter((f): f is FilterArrayItem => f !== null);
    if (cleaned.length) out.filters = cleaned;
  }
  if (query.order && query.order.length) out.order = query.order;
  if (typeof query.limit === "number") out.limit = query.limit;
  if (typeof query.offset === "number" && query.offset > 0) out.offset = query.offset;
  if (query.timezone) out.timezone = query.timezone;
  return out;
}

/** Drop incomplete filter rows (no member, no operator, missing values when required). */
function isCompleteClause(f: FilterClause | undefined | null): f is FilterClause {
  if (!f) return false;
  if (!f.member || !f.operator) return false;
  if (f.operator === "set" || f.operator === "notSet") return true;
  return Array.isArray(f.values) && f.values.length > 0;
}

function cleanFilterItem(item: FilterArrayItem): FilterArrayItem | null {
  if ("or" in item || "and" in item) {
    const key = "or" in item ? "or" : "and";
    const inner = (item as Record<string, FilterClause[] | undefined>)[key] || [];
    const kept = inner.filter(isCompleteClause);
    if (kept.length === 0) return null;
    if (kept.length === 1) return kept[0];
    return { [key]: kept } as FilterArrayItem;
  }
  return isCompleteClause(item as FilterClause) ? (item as FilterClause) : null;
}

/**
 * Combine a flat list of filter clauses with the requested boolean mode.
 * "and" returns the clauses as-is (sibling array items are AND'd by Square).
 * "or" wraps them in `[{ or: [...] }]`. A single clause is always returned
 * unwrapped, regardless of mode, because there's nothing to combine.
 */
/** Convert builder UI state to the tuple list Square's `/v1/load` expects. */
export function orderClauseToTuples(order: OrderClause): OrderTuple[] {
  return Object.entries(order).map(
    ([member, dir]) => [member, dir as OrderDirection],
  );
}

export function assembleFilters(
  clauses: FilterClause[],
  mode: "and" | "or",
): FilterArrayItem[] {
  const kept = clauses.filter(isCompleteClause);
  if (kept.length === 0) return [];
  if (kept.length === 1 || mode === "and") return kept;
  return [{ or: kept }];
}

/**
 * Best-effort detection of the cube name(s) referenced by a query. The
 * Reporting API requires every member in a single query to share the same
 * cube — we use this to disable mixing across cubes in the UI.
 */
export function membersToCubes(members: string[]): string[] {
  const cubes = new Set<string>();
  for (const m of members) {
    const dot = m.indexOf(".");
    if (dot > 0) cubes.add(m.slice(0, dot));
  }
  return [...cubes];
}

/** Validate a query against the discovered metadata for friendlier errors. */
export function validateAgainstMeta(
  query: ReportingQuery,
  cubes: CubeMeta[],
): string[] {
  const errors: string[] = [];
  const allMeasures = new Set<string>();
  const allDimensions = new Set<string>();
  const allSegments = new Set<string>();
  const allFilterable = new Set<string>();
  for (const c of cubes) {
    for (const m of c.measures) {
      allMeasures.add(m.name);
      allFilterable.add(m.name);
    }
    for (const d of c.dimensions) {
      allDimensions.add(d.name);
      allFilterable.add(d.name);
    }
    for (const s of c.segments) allSegments.add(s.name);
  }
  for (const m of query.measures || []) {
    if (!allMeasures.has(m)) errors.push(`Unknown measure: ${m}`);
  }
  for (const d of query.dimensions || []) {
    if (!allDimensions.has(d)) errors.push(`Unknown dimension: ${d}`);
  }
  for (const td of query.timeDimensions || []) {
    if (!allDimensions.has(td.dimension)) {
      errors.push(`Unknown time dimension: ${td.dimension}`);
    }
  }
  for (const s of query.segments || []) {
    if (!allSegments.has(s)) errors.push(`Unknown segment: ${s}`);
  }
  for (const item of query.filters || []) {
    const clauses: FilterClause[] = [];
    if ("or" in item) clauses.push(...(item.or || []));
    else if ("and" in item) clauses.push(...(item.and || []));
    else clauses.push(item as FilterClause);
    for (const c of clauses) {
      if (!allFilterable.has(c.member)) {
        errors.push(`Unknown filter member: ${c.member}`);
      }
    }
  }
  return errors;
}
