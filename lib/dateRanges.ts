/**
 * The Reporting API accepts both relative date-range strings ("today",
 * "last 30 days", ...) and absolute `[start, end]` tuples. We expose a small
 * preset list to power the date-range dropdown in the time-dimension editor.
 */

export interface DateRangePreset {
  /** Stable ID used as the <option> value. */
  id: string;
  /** Human label for the dropdown. */
  label: string;
  /** Sent verbatim to the Reporting API as `dateRange`. */
  value: string;
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { id: "today", label: "Today", value: "today" },
  { id: "yesterday", label: "Yesterday", value: "yesterday" },
  { id: "this-week", label: "This week", value: "this week" },
  { id: "last-week", label: "Last week", value: "last week" },
  { id: "this-month", label: "This month", value: "this month" },
  { id: "last-month", label: "Last month", value: "last month" },
  { id: "last-7-days", label: "Last 7 days", value: "last 7 days" },
  { id: "last-30-days", label: "Last 30 days", value: "last 30 days" },
  { id: "last-90-days", label: "Last 90 days", value: "last 90 days" },
  { id: "this-quarter", label: "This quarter", value: "this quarter" },
  { id: "last-quarter", label: "Last quarter", value: "last quarter" },
  { id: "this-year", label: "This year", value: "this year" },
  { id: "last-year", label: "Last year", value: "last year" },
];

export const CUSTOM_RANGE_ID = "custom";
