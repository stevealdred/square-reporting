/**
 * Type definitions for the Square Reporting API surface area exposed to this
 * client. These are intentionally permissive — Square may add fields without
 * notice, so anything beyond what we strictly use is captured as
 * `Record<string, unknown>` instead of typed.
 */

/** Stability levels Square attaches to cubes / fields via `meta.stability`. */
export type Stability = "preview" | "beta" | "ga" | "deprecated";

/** Operators supported by the `filters` array in a Reporting query. */
export type FilterOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "inDateRange"
  | "notInDateRange"
  | "set"
  | "notSet";

/** Granularities supported by `timeDimensions[*].granularity`. */
export type Granularity =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

/** Sort directions accepted by the Reporting API. */
export type OrderDirection = "asc" | "desc";

/** Fully-qualified member name, e.g. "Sales.net_sales". */
export type Member = string;

export interface MetaTags {
  label?: string;
  tooltip?: string;
  context?: string;
  stability?: Stability;
  deprecated_at?: string;
  /** Allowed values for enum-like dimensions. */
  values?: string[];
  /** Example queries documenting usage (cubes only). */
  examples?: unknown[];
  [key: string]: unknown;
}

export interface MeasureMeta {
  name: Member;
  title?: string;
  shortTitle?: string;
  description?: string;
  /** "number" | "string" | "time" — Square uses these for measures. */
  type?: string;
  /** sum | count | avg | min | max | countDistinct | etc. */
  aggType?: string;
  /** "currency" | "percent" | "number" | etc. */
  format?: string;
  drillMembers?: Member[];
  meta?: MetaTags;
}

export interface DimensionMeta {
  name: Member;
  title?: string;
  shortTitle?: string;
  description?: string;
  /** "string" | "number" | "time" | "boolean". */
  type?: string;
  format?: string;
  suggestFilterValues?: boolean;
  meta?: MetaTags;
}

export interface SegmentMeta {
  name: Member;
  title?: string;
  shortTitle?: string;
  description?: string;
  meta?: MetaTags;
}

export interface CubeMeta {
  name: string;
  title?: string;
  description?: string;
  /** Square distinguishes "view" (recommended) from "cube" (raw). */
  type?: "view" | "cube" | string;
  measures: MeasureMeta[];
  dimensions: DimensionMeta[];
  segments: SegmentMeta[];
  meta?: MetaTags;
}

export interface ReportingMeta {
  cubes: CubeMeta[];
}

/** A single time-dimension clause inside a query. */
export interface TimeDimensionClause {
  dimension: Member;
  /**
   * Either a relative range string ("today", "last 30 days", ...) or an
   * absolute `[startDate, endDate]` tuple in `YYYY-MM-DD` format.
   */
  dateRange?: string | [string, string];
  granularity?: Granularity;
}

/** A single filter clause. */
export interface FilterClause {
  member: Member;
  operator: FilterOperator;
  values?: string[];
}

/**
 * Cube/Square filter "boolean group" wrapper. When sent to the API, a query
 * may include `[ { or: [...filterClauses] } ]` to OR a set of filters
 * together (the default for sibling filter array items is AND).
 */
export interface BooleanFilterGroup {
  or?: FilterClause[];
  and?: FilterClause[];
}

/** A filter array entry can be either a single clause or a boolean group. */
export type FilterArrayItem = FilterClause | BooleanFilterGroup;

/** UI-friendly map form used by the query builder (not sent to the API). */
export type OrderClause = Record<Member, OrderDirection>;

/** API wire format: list of `[member, direction]` pairs (Cube.js tuple style). */
export type OrderTuple = [Member, OrderDirection];

/** Shape of the JSON sent in `{ query: ... }` to `/v1/load`. */
export interface ReportingQuery {
  measures?: Member[];
  dimensions?: Member[];
  timeDimensions?: TimeDimensionClause[];
  segments?: Member[];
  filters?: FilterArrayItem[];
  order?: OrderTuple[];
  limit?: number;
  offset?: number;
  timezone?: string;
}

/** Successful response from `POST /v1/load`. */
export interface ReportingLoadResponse {
  data: Array<Record<string, string | number | null>>;
  annotation?: {
    measures?: Record<string, MeasureMeta>;
    dimensions?: Record<string, DimensionMeta>;
    segments?: Record<string, SegmentMeta>;
    timeDimensions?: Record<string, DimensionMeta>;
  };
  query?: ReportingQuery;
  slowQuery?: boolean;
}

/**
 * A subset of the Square `Location` resource we care about for the picker.
 * The full shape (returned by `GET /v2/locations`) has many more fields; we
 * pass the response through without strict typing on the rest.
 */
export interface SquareLocation {
  id: string;
  name?: string;
  status?: "ACTIVE" | "INACTIVE" | string;
  type?: string;
  timezone?: string;
  /** ISO 4217 currency code for this location (e.g. "CAD", "USD"). */
  currency?: string;
  /** ISO 3166-1-alpha-2 country code (e.g. "CA", "US"). */
  country?: string;
  address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    administrative_district_level_1?: string;
    postal_code?: string;
    country?: string;
  };
  business_name?: string;
}

/** Shape returned by our own `/api/query` endpoint. */
export type ApiQueryResponse =
  | {
      ok: true;
      data: ReportingLoadResponse["data"];
      annotation: ReportingLoadResponse["annotation"];
      slowQuery: boolean;
      attempts: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
      detail?: unknown;
      attempts?: number;
    };
