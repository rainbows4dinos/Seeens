import Papa from "papaparse";

// Stable export columns. Don't rename or reorder: people build spreadsheets
// on top of these headers. Add new columns at the end.
export const EXPORT_COLUMNS = [
  "catalog_no",
  "name",
  "kind",
  "types",
  "status",
  "played_together",
  "our_band",
  "town",
  "region",
  "country",
  "scenes",
  "can_help_with",
  "email",
  "phone",
  "links",
  "notes",
  "next_action",
  "next_action_date",
  "next_action_owner",
  "archived_on",
  "added_on",
  "updated_on",
] as const;

export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string>;

// Separator inside multi-value cells (scenes, links, types).
export const LIST_SEPARATOR = "; ";

// A cell starting with one of these could run as a spreadsheet formula, so it
// gets a leading apostrophe. Checked on the first character only, so
// multi-line notes are covered too.
export const FORMULA_START = /^[=+\-@\t\r]/;

export function toCsv(rows: ExportRow[]) {
  return Papa.unparse(
    { fields: [...EXPORT_COLUMNS], data: rows.map((r) => EXPORT_COLUMNS.map((c) => r[c])) },
    { quotes: false, newline: "\r\n", escapeFormulae: FORMULA_START },
  );
}
