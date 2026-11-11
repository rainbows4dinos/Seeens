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
  // #139: "status" is the stored value (homies, lets_play, prospect, neutral,
  // avoid), which never changes; this is the word the connection's type uses.
  "status_label",
  // #48: venue details, as shown (blank when not sure).
  "ages",
  "capacity",
  "space",
  "pa",
  "sound_engineer",
  "backline",
  "book_via",
  "address",
  "accessibility",
  "special_terms",
  "details_checked_on",
  // #262: what kind of venue, "Dive Bar; Art Space or Gallery". Added last, so
  // older columns stay where they were.
  "venue_types",
] as const;

export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string>;

// Separator inside multi-value cells (scenes, links, types).
export const LIST_SEPARATOR = "; ";

// A cell starting with one of these could run as a spreadsheet formula, so it
// gets a leading apostrophe. Checked on the first character only, so
// multi-line notes are covered too.
export const FORMULA_START = /^[=+\-@\t\r]/;

// Spreadsheet apps guess cell types, so "BND-0057" turns into -57 Brunei
// dollars in Numbers, a band called "1876" into a number, and a phone number
// loses its dashes or leading zero. These cells go out as ="..." so Numbers,
// Excel and Google Sheets all show them as plain text. The import wizard
// unwraps them (see unwrapCell in lib/import/rows).
const ALWAYS_TEXT = new Set<string>(["catalog_no"]);
const TEXT_IF_NUMBERY = new Set<string>(["name", "phone"]);
// Has a digit and no letters, on one line: "1876", "503-555-0100", "1/2", "$5".
const NUMBERY = /^[^\p{L}\r\n]*\d[^\p{L}\r\n]*$/u;

export const asText = (v: string) => `="${v.replace(/"/g, '""')}"`;

function cell(column: string, v: string) {
  if (v && (ALWAYS_TEXT.has(column) || (TEXT_IF_NUMBERY.has(column) && NUMBERY.test(v)))) return asText(v);
  return FORMULA_START.test(v) ? `'${v}` : v;
}

export function toCsv(rows: ExportRow[]) {
  return Papa.unparse(
    { fields: [...EXPORT_COLUMNS], data: rows.map((r) => EXPORT_COLUMNS.map((c) => cell(c, r[c]))) },
    { quotes: false, newline: "\r\n" },
  );
}
