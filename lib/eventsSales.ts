/**
 * Event gratuity location-day totals for the Duttons/Telus workbook.
 *
 * Same auth and location-id pattern as suites sales, but returns one row per
 * Date × Location so events can share or split a day’s Square totals.
 */

import { runReportingQuery } from "./squareReporting";
import {
  parsePayPeriod,
  parseRequestedLocations,
  type RequestedLocation,
} from "./suitesSales";
import type { ReportingLoadResponse, ReportingQuery } from "./types";

export interface EventsSalesRow {
  Date: string;
  Location: string;
  "Net Sales": number;
  "Service Charge": number;
  Tips: number;
}

export { parsePayPeriod, parseRequestedLocations };

export async function loadEventsSales(
  start: string,
  end: string,
  accessToken: string,
  locations: RequestedLocation[],
): Promise<
  | { ok: true; rows: EventsSalesRow[] }
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

  const nameById = new Map(locations.map((row) => [row.id, row.location]));
  const net = sumByDayLocation(orderRows, "Orders.location_id", "Orders.local_date", "Orders.net_sales");
  const tips = sumByDayLocation(orderRows, "Orders.location_id", "Orders.local_date", "Orders.tips_amount");
  const sc = sumByDayLocation(
    chargeRows,
    "ServiceChargesReport.location_id",
    "ServiceChargesReport.reporting_day",
    "ServiceChargesReport.total_service_charge_amount",
  );

  const keys = new Set<string>([...net.keys(), ...tips.keys(), ...sc.keys()]);
  const rows: EventsSalesRow[] = [];
  for (const key of keys) {
    const [locationId, date] = key.split("|");
    const location = nameById.get(locationId);
    if (!location || !date) continue;
    rows.push({
      Date: date,
      Location: location,
      "Net Sales": round2(net.get(key) ?? 0),
      "Service Charge": round2(sc.get(key) ?? 0),
      Tips: round2(tips.get(key) ?? 0),
    });
  }

  const locationOrder = new Map(locations.map((row, index) => [row.location, index]));
  rows.sort((a, b) => {
    if (a.Date !== b.Date) return a.Date < b.Date ? -1 : 1;
    return (locationOrder.get(a.Location) ?? 0) - (locationOrder.get(b.Location) ?? 0);
  });
  return { ok: true, rows };
}

function ordersQuery(start: string, end: string, locationIds: string[]): ReportingQuery {
  return {
    measures: ["Orders.net_sales", "Orders.tips_amount"],
    dimensions: ["Orders.location_id", "Orders.local_date"],
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
    dimensions: ["ServiceChargesReport.location_id", "ServiceChargesReport.reporting_day"],
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

function sumByDayLocation(
  rows: ReportingLoadResponse["data"],
  locationMember: string,
  dateMember: string,
  measureMember: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const locationId = textValue(fieldByName(row, locationMember));
    const date = normalizeDate(fieldByName(row, dateMember));
    if (!locationId || !date) continue;
    const key = `${locationId}|${date}`;
    totals.set(key, (totals.get(key) ?? 0) + asNumber(fieldByName(row, measureMember)));
  }
  return totals;
}

function normalizeDate(value: string | number | null): string {
  const text = textValue(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
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
