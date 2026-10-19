/**
 * Suites team-member tips for the workbook.
 *
 * Location ids come from the workbook request. Person numbers are
 * TeamMemberCore.reference_id. Tip amounts are
 * EmployeeTipsAndCommissionsReport.tip_amount. The access token is never
 * read or returned here.
 */

import { runReportingQuery } from "./squareReporting";
import type { RequestedLocation } from "./suitesSales";
import type { ReportingLoadResponse, ReportingQuery } from "./types";

export interface SuitesTipRow {
  "Person Number": number;
  Location: string;
  Tips: number;
}

const RESULT_LIMIT = 5000;
const TIP_VIEW = "EmployeeTipsAndCommissionsReport";
const MEMBER_CUBE = "TeamMemberCore";

export async function loadSuitesTips(
  start: string,
  end: string,
  accessToken: string,
  locations: RequestedLocation[],
): Promise<{ ok: true; rows: SuitesTipRow[] } | { ok: false; status: number; error: string }> {
  if (locations.length === 0) return { ok: true, rows: [] };

  const locationIds = locations.map((row) => row.id);
  const tips = await runReportingQuery(tipsQuery(start, end, locationIds), accessToken);
  const tipRows = dataRows(tips);
  if (!tipRows) return queryFailure(tips);
  if (tipRows.length >= RESULT_LIMIT) {
    return {
      ok: false,
      status: 502,
      error: "Square returned too many tip rows for one pay period.",
    };
  }

  const amounts = sumTips(tipRows);
  const memberIds = [...amounts.keys()];
  if (memberIds.length === 0) return { ok: true, rows: [] };

  const members = await runReportingQuery(memberQuery(memberIds), accessToken);
  const memberRows = dataRows(members);
  if (!memberRows) return queryFailure(members);
  if (memberRows.length >= RESULT_LIMIT) {
    return {
      ok: false,
      status: 502,
      error: "Square returned too many team members for one pay period.",
    };
  }

  const personByMember = personNumbers(memberRows);
  const missing = memberIds.filter((id) => !personByMember.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      status: 502,
      error: "A team member with tips has no person number in Team Member Core.",
    };
  }

  const nameById = new Map(locations.map((row) => [row.id, row.location]));
  const rows: SuitesTipRow[] = [];
  for (const [memberId, byLocation] of amounts) {
    const person = personByMember.get(memberId);
    if (person == null) continue;
    for (const [locationId, amount] of byLocation) {
      const tipsAmount = round2(amount);
      if (tipsAmount === 0) continue;
      const location = nameById.get(locationId);
      if (!location) continue;
      rows.push({
        "Person Number": person,
        Location: location,
        Tips: tipsAmount,
      });
    }
  }

  const locationOrder = new Map(locations.map((row, index) => [row.location, index]));
  rows.sort((a, b) => {
    const locationCompare =
      (locationOrder.get(a.Location) ?? 0) - (locationOrder.get(b.Location) ?? 0);
    if (locationCompare !== 0) return locationCompare;
    return a["Person Number"] - b["Person Number"];
  });
  return { ok: true, rows };
}

function tipsQuery(start: string, end: string, locationIds: string[]): ReportingQuery {
  return {
    measures: [`${TIP_VIEW}.tip_amount`],
    dimensions: [`${TIP_VIEW}.team_member_id`, `${TIP_VIEW}.location_id`],
    filters: [
      {
        member: `${TIP_VIEW}.local_date`,
        operator: "inDateRange",
        values: [start, end],
      },
      {
        member: `${TIP_VIEW}.location_id`,
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

function sumTips(
  rows: ReportingLoadResponse["data"],
): Map<string, Map<string, number>> {
  const totals = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const memberId = textValue(fieldByName(row, `${TIP_VIEW}.team_member_id`));
    const locationId = textValue(fieldByName(row, `${TIP_VIEW}.location_id`));
    if (!memberId || !locationId) continue;
    const amount = asNumber(fieldByName(row, `${TIP_VIEW}.tip_amount`));
    if (amount === 0) continue;
    const byLocation = totals.get(memberId) ?? new Map<string, number>();
    byLocation.set(locationId, (byLocation.get(locationId) ?? 0) + amount);
    totals.set(memberId, byLocation);
  }
  return totals;
}

function personNumbers(rows: ReportingLoadResponse["data"]): Map<string, number> {
  const people = new Map<string, number>();
  for (const row of rows) {
    const memberId = textValue(fieldByName(row, `${MEMBER_CUBE}.team_member_id`));
    if (!memberId) continue;
    const person = personNumber(fieldByName(row, `${MEMBER_CUBE}.reference_id`));
    if (person == null) continue;
    people.set(memberId, person);
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
