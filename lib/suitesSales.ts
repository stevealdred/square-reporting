/**
 * Suites gratuity totals for the workbook.
 *
 * Location ids come from the workbook request, not from this file.
 * The access token is never read or returned here; callers pass the
 * token from `resolveAccountToken`.
 */

import { runReportingQuery } from "./squareReporting";
import type { ReportingLoadResponse, ReportingQuery } from "./types";

export interface RequestedLocation {
  location: string;
  id: string;
}

const LOCATION_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_LOCATIONS = 50;

export interface SuitesSalesRow {
  Location: string;
  "Net Sales": number;
  "Service Charge": number;
  Tips: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parsePayPeriod(
  start: string | null,
  end: string | null,
): { start: string; end: string } | { error: string } {
  if (!start || !end || !isIsoDate(start) || !isIsoDate(end)) {
    return { error: "start and end must be dates in YYYY-MM-DD form." };
  }
  if (end < start) {
    return { error: "Pay period end is before the start date." };
  }
  return { start, end };
}

export function parseRequestedLocations(
  value: unknown,
): { locations: RequestedLocation[] } | { error: string } {
  if (!Array.isArray(value)) {
    return { error: "locations must be a list of location and id." };
  }
  if (value.length > MAX_LOCATIONS) {
    return { error: "locations cannot include more than 50 rows." };
  }

  const locations: RequestedLocation[] = [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { error: "Each location must include a name and a Square location id." };
    }
    const record = item as Record<string, unknown>;
    const location = typeof record.location === "string" ? record.location.trim() : "";
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!location || location.length > 80 || /[\u0000-\u001F]/.test(location)) {
      return { error: "Each location needs a name." };
    }
    if (!LOCATION_ID.test(id)) {
      return { error: `Square location id for ${location} is not valid.` };
    }
    const nameKey = location.toLowerCase();
    if (seenNames.has(nameKey)) {
      return { error: `Location ${location} is listed more than once.` };
    }
    if (seenIds.has(id)) {
      return { error: `Square location id ${id} is listed more than once.` };
    }
    seenNames.add(nameKey);
    seenIds.add(id);
    locations.push({ location, id });
  }
  return { locations };
}

export async function loadSuitesSales(
  start: string,
  end: string,
  accessToken: string,
  locations: RequestedLocation[],
): Promise<
  | { ok: true; rows: SuitesSalesRow[] }
  | { ok: false; status: number; error: string }
> {
  if (locations.length === 0) return { ok: true, rows: [] };

  const locationIds = locations.map((row) => row.id);
  const [orders, charges] = await Promise.all([
    runReportingQuery(ordersQuery(start, end, locationIds), accessToken),
    runReportingQuery(serviceChargeQuery(start, end, locationIds), accessToken),
  ]);

  const orderRows = dataRows(orders);
  if (!orderRows) return queryFailure(orders);
  const chargeRows = dataRows(charges);
  if (!chargeRows) return queryFailure(charges);

  const net = sumByLocation(orderRows, "Orders.location_id", "Orders.net_sales");
  const tips = sumByLocation(orderRows, "Orders.location_id", "Orders.tips_amount");
  // total_service_charge_amount is already net of tax. Subtracting
  // total_service_charge_tax removes the tax a second time.
  const scAmount = sumByLocation(
    chargeRows,
    "ServiceChargesReport.location_id",
    "ServiceChargesReport.total_service_charge_amount",
  );

  return {
    ok: true,
    rows: locations.map((row) => ({
      Location: row.location,
      "Net Sales": round2(net.get(row.id) ?? 0),
      "Service Charge": round2(scAmount.get(row.id) ?? 0),
      Tips: round2(tips.get(row.id) ?? 0),
    })),
  };
}

function ordersQuery(start: string, end: string, locationIds: string[]): ReportingQuery {
  return {
    measures: ["Orders.net_sales", "Orders.tips_amount"],
    dimensions: ["Orders.location_id"],
    // Closed checks match Sales Summary. An open tab is not net sales yet.
    segments: ["Orders.closed_checks"],
    filters: [
      {
        member: "Orders.local_reporting_timestamp",
        operator: "inDateRange",
        values: [start, end],
      },
      {
        member: "Orders.location_id",
        operator: "equals",
        values: locationIds,
      },
    ],
    limit: 5000,
  };
}

function serviceChargeQuery(
  start: string,
  end: string,
  locationIds: string[],
): ReportingQuery {
  return {
    measures: ["ServiceChargesReport.total_service_charge_amount"],
    dimensions: ["ServiceChargesReport.location_id"],
    filters: [
      {
        member: "ServiceChargesReport.reporting_day",
        operator: "inDateRange",
        values: [start, end],
      },
      {
        member: "ServiceChargesReport.location_id",
        operator: "equals",
        values: locationIds,
      },
    ],
    limit: 5000,
  };
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function dataRows(
  result: Awaited<ReturnType<typeof runReportingQuery>>,
): ReportingLoadResponse["data"] | null {
  if (result.status !== 200 || !isLoadResponse(result.json)) return null;
  return result.json.data;
}

function queryFailure(
  result: Awaited<ReturnType<typeof runReportingQuery>>,
): { ok: false; status: number; error: string } {
  const json = result.json;
  const message =
    json &&
    typeof json === "object" &&
    "error" in json &&
    typeof (json as { error?: unknown }).error === "string"
      ? (json as { error: string }).error
      : `Square Reporting API returned HTTP ${result.status}.`;
  const status = result.status >= 400 ? result.status : 502;
  return { ok: false, status, error: message };
}

function isLoadResponse(value: unknown): value is ReportingLoadResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ReportingLoadResponse).data)
  );
}

function sumByLocation(
  rows: ReportingLoadResponse["data"],
  locationMember: string,
  measureMember: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const locationId = textValue(fieldByName(row, locationMember));
    if (!locationId) continue;
    const next = (totals.get(locationId) ?? 0) + asNumber(fieldByName(row, measureMember));
    totals.set(locationId, next);
  }
  return totals;
}

function fieldByName(
  row: Record<string, string | number | null>,
  exactName: string,
): string | number | null {
  if (Object.prototype.hasOwnProperty.call(row, exactName)) return row[exactName];
  const key = Object.keys(row).find((name) => name.startsWith(exactName));
  return key ? row[key] : null;
}

function textValue(value: string | number | null): string {
  if (value == null) return "";
  return String(value);
}

function asNumber(value: string | number | null): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = value.trim().replaceAll("$", "").replaceAll(",", "");
  if (!cleaned || cleaned === "null") return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
