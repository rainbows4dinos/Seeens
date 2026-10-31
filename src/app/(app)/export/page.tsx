import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EXPORT_COLUMNS } from "@/lib/export/csv";
import { NoWorkspace } from "@/components/no-workspace";

export const metadata: Metadata = { title: "Export · Seeens" };

export default function ExportPage({ searchParams }: PageProps<"/export">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Export</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Export searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Export({ searchParams }: { searchParams: PageProps<"/export">["searchParams"] }) {
  const membership = await getMembership();
  if (!membership) return <NoWorkspace />;
  const { problem, archived } = await searchParams;
  const includeArchived = archived === "include";

  const supabase = await createClient();
  const [current, archivedCount] = await Promise.all([
    supabase.from("connections").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("connections").select("id", { count: "exact", head: true }).not("archived_at", "is", null),
  ]);
  const nCurrent = current.count ?? 0;
  const nArchived = archivedCount.count ?? 0;

  if (nCurrent + nArchived === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-line p-6">
        <p className="font-medium">Nothing to export yet.</p>
        <p className="text-muted">Add a connection and it&rsquo;ll show up in the export.</p>
        <Link href="/connections/new" className="button-secondary">
          Add a connection
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        A spreadsheet copy of {membership.workspaceName}&rsquo;s directory, as a CSV file. It opens in Excel,
        Numbers, or Google Sheets.
      </p>

      {problem === "failed" ? (
        <p role="alert" className="rounded-md border border-error p-3 text-sm font-semibold text-error">
          The export didn&rsquo;t finish. Nothing was downloaded; try again.
        </p>
      ) : problem === "empty" ? (
        <p role="status" className="rounded-md border border-line p-3 text-sm font-medium">
          No connections matched, so there was nothing to download. Try including archived connections.
        </p>
      ) : null}

      <form action="/api/export" method="get" className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Which connections?</legend>
          <div className="flex flex-wrap gap-2">
            <label className="choice">
              <input type="radio" name="archived" value="exclude" defaultChecked={!includeArchived} />
              <span>Current only ({nCurrent})</span>
            </label>
            <label className="choice">
              <input type="radio" name="archived" value="include" defaultChecked={includeArchived} />
              <span>Current and archived ({nCurrent + nArchived})</span>
            </label>
          </div>
        </fieldset>
        <div>
          <button type="submit" className="button-primary">
            Download CSV
          </button>
        </div>
      </form>

      <section aria-labelledby="export-whats-in" className="flex flex-col gap-2 text-sm">
        <h2 id="export-whats-in" className="text-lg font-semibold">
          What&rsquo;s in it
        </h2>
        <p>
          One row per connection: who they are, status, town, scenes, contact info, links, notes, and their current
          next action. <strong>Outreach history isn&rsquo;t included.</strong>
        </p>
        <p className="text-muted">
          Dates are written as year-month-day (2026-11-03), Pacific time. Lists like scenes and links are separated
          by semicolons. Cells that start with =, +, -, or @ get a leading apostrophe so spreadsheets show them as
          text instead of running them.
        </p>
        <details>
          <summary className="cursor-pointer text-muted">Column names</summary>
          <p className="pt-2 font-mono text-xs break-words">{EXPORT_COLUMNS.join(", ")}</p>
        </details>
      </section>
    </div>
  );
}
