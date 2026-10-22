/**
 * Event gratuity team-member day totals for the Duttons/Telus workbook.
 *
 * Returns Date × Location × Person Number with net sales and tips.
 * Service charge stays on the location-day Events sales pull; managers can
 * override per staff line in the workbook when needed.
 */

import { runReportingQuery } from "./squareReporting";
import type { RequestedLocation } from "./suitesSales";
import type { ReportingLoadResponse, ReportingQuery } from "./types";

export interface EventsTeamRow {
  Date: string;
  Location: string;
  "Person Number": number;
  Employee: string;
  "Net Sales": number;
  Tips: number;
}

const RESULT_LIMIT = 5000;
const MEMBER_CUBE = "TeamMemberCore";

export async function loadEventsTeam(
  start: string,
  end: string,
  accessToken: string,
  locations: RequestedLocation[],
): Promise<
  | { ok: true; rows: EventsTeamRow[] }
  | { ok: false; status: number; error: string }
> {
  if (locations.length === 0) return { ok: true, rows: [] };

  const locationIds = locations.map((row) => row.id);
  const orders = await runReportingQuery(ordersQuery(start, end, locationIds), accessToken);
  const orderRows = dataRows(orders);
  if (!orderRows) return queryFailure(orders);
  if (orderRows.length >= RESULT_LIMIT) {
    return {
      ok: false,
      status: 502,
      error: "Square returned too many team sales rows for one period.",
    };
  }

  const amounts = sumByMemberDay(orderRows);
  const memberIds = [...new Set([...amounts.keys()].map((key) => key.split("|")[0]).filter(Boolean))];
  if (memberIds.length === 0) return { ok: true, rows: [] };

  const members = await runReportingQuery(memberQuery(memberIds), accessToken);
  const memberRows = dataRows(members);
  if (!memberRows) return queryFailure(members);

  const personByMember = personLookup(memberRows);
  const nameById = new Map(locations.map((row) => [row.id, row.location]));
  const rows: EventsTeamRow[] = [];

  for (const [key, money] of amounts) {
    const [memberId, locationId, date] = key.split("|");
    const location = nameById.get(locationId);
    const person = personByMember.get(memberId);
    if (!location || !date || person == null) continue;
    if (money.net === 0 && money.tips === 0) continue;
    rows.push({
      Date: date,
      Location: location,
      "Person Number": person.number,
      Employee: person.name,
      "Net Sales": round2(money.net),
      Tips: round2(money.tips),
    });
  }

  const locationOrder = new Map(locations.map((row, index) => [row.location, index]));
  rows.sort((a, b) => {
    if (a.Date !== b.Date) return a.Date < b.Date ? -1 : 1;
    const loc = (locationOrder.get(a.Location) ?? 0) - (locationOrder.get(b.Location) ?? 0);
    if (loc !== 0) return loc;
    return a["Person Number"] - b["Person Number"];
  });
  return { ok: true, rows };
}

function ordersQuery(start: string, end: string, locationIds: string[]): ReportingQuery {
  return {
    measures: ["Orders.net_sales", "Orders.tips_amount"],
    dimensions: [
      "Orders.location_id",
      "Orders.local_date",
      "Orders.team_member_attributed_to",
      "Orders.team_member_attributed_to_name",
    ],
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
    limit: RESULT_LIMIT,
  };
}

function memberQuery(memberIds: string[]): ReportingQuery {
  return {
    dimensions: [
      `${MEMBER_CUBE}.team_member_id`,
      `${MEMBER_CUBE}.reference_id`,
      `${MEMBER_CUBE}.given_name`,
      `${MEMBER_CUBE}.family_name`,
    ],
    filters: [
      {
        member: `${MEMBER_CUBE}.team_member_id`,
        operator: "equals",
        values: memberIds,
      },
    ],
    limit: RESULT_LIMIT,
  };
}

function sumByMemberDay(
  rows: ReportingLoadResponse["data"],
): Map<string, { net: number; tips: number }> {
  const totals = new Map<string, { net: number; tips: number }>();
  for (const row of rows) {
    const memberId = textValue(fieldByName(row, "Orders.team_member_attributed_to"));
    const locationId = textValue(fieldByName(row, "Orders.location_id"));
    const date = normalizeDate(fieldByName(row, "Orders.local_date"));
    if (!memberId || !locationId || !date) continue;
    const key = `${memberId}|${locationId}|${date}`;
    const prev = totals.get(key) ?? { net: 0, tips: 0 };
    prev.net += asNumber(fieldByName(row, "Orders.net_sales"));
    prev.tips += asNumber(fieldByName(row, "Orders.tips_amount"));
    totals.set(key, prev);
  }
  return totals;
}

function personLookup(
  rows: ReportingLoadResponse["data"],
): Map<string, { number: number; name: string }> {
  const people = new Map<string, { number: number; name: string }>();
  for (const row of rows) {
    const memberId = textValue(fieldByName(row, `${MEMBER_CUBE}.team_member_id`));
    if (!memberId) continue;
    const person = personNumber(fieldByName(row, `${MEMBER_CUBE}.reference_id`));
    if (person == null) continue;
    const given = textValue(fieldByName(row, `${MEMBER_CUBE}.given_name`)).trim();
    const family = textValue(fieldByName(row, `${MEMBER_CUBE}.family_name`)).trim();
    const name =
      family && given ? `${family}, ${given}` : family || given || String(person);
    people.set(memberId, { number: person, name });
  }
  return people;
}

function personNumber(value: string | number | null): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  const text = textValue(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
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
