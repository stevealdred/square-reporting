/**
 * Suites gratuity totals for the workbook.
 *
 * Location ids are filled in here, not in the Excel file. Leave `include`
 * false until the id is confirmed. Saddleroom stays off until that id is
 * confirmed for these pools. The access token is never read or returned here;
 * callers pass the token from `resolveAccountToken`.
 */

import { runReportingQuery } from "./squareReporting";
import type { ReportingLoadResponse, ReportingQuery } from "./types";

export interface SuitesLocation {
  locationId: string;
  workbookLocation: string;
  include: boolean;
  sort: number;
}

export const SUITES_LOCATIONS: SuitesLocation[] = [
  { locationId: "REPLACE_CLUB", workbookLocation: "Club Level Pantry", include: false, sort: 1 },
  { locationId: "REPLACE_ALUMNI", workbookLocation: "Alumni Pantry", include: false, sort: 2 },
  { locationId: "REPLACE_SADDLE", workbookLocation: "Saddleroom Pantry", include: false, sort: 3 },
  { locationId: "REPLACE_EAST", workbookLocation: "East Suites", include: false, sort: 4 },
  { locationId: "REPLACE_WEST", workbookLocation: "West Suites", include: false, sort: 5 },
];

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

export function includedSuitesLocations(): SuitesLocation[] {
  return SUITES_LOCATIONS.filter(
    (row) => row.include && !row.locationId.startsWith("REPLACE_"),
  ).sort((a, b) => a.sort - b.sort);
}

export async function loadSuitesSales(
  start: string,
  end: string,
  accessToken: string,
): Promise<
  | { ok: true; rows: SuitesSalesRow[] }
  | { ok: false; status: number; error: string }
> {
  const included = includedSuitesLocations();
  if (included.length === 0) return { ok: true, rows: [] };

  const locationIds = included.map((row) => row.locationId);
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
  const scAmount = sumByLocation(
    chargeRows,
    "ServiceChargesReport.location_id",
    "ServiceChargesReport.total_service_charge_amount",
  );
  const scTax = sumByLocation(
    chargeRows,
    "ServiceChargesReport.location_id",
    "ServiceChargesReport.total_service_charge_tax",
  );

  return {
    ok: true,
    rows: included.map((row) => ({
      Location: row.workbookLocation,
      "Net Sales": round2(net.get(row.locationId) ?? 0),
      "Service Charge": round2(
        (scAmount.get(row.locationId) ?? 0) - (scTax.get(row.locationId) ?? 0),
      ),
      Tips: round2(tips.get(row.locationId) ?? 0),
    })),
  };
}

function ordersQuery(start: string, end: string, locationIds: string[]): ReportingQuery {
  return {
    measures: ["Orders.net_sales", "Orders.tips_amount"],
    dimensions: ["Orders.location_id"],
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
    measures: [
      "ServiceChargesReport.total_service_charge_amount",
      "ServiceChargesReport.total_service_charge_tax",
    ],
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
