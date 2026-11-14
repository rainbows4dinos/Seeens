import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { MAX_SELECTED, buildExportRows } from "@/lib/export/build";
import { toCsv } from "@/lib/export/csv";
import { todayISO } from "@/lib/outreach/labels";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

function back(request: Request, reason: "empty" | "failed", archived: boolean) {
  const url = new URL("/export", request.url);
  url.searchParams.set("problem", reason);
  if (archived) url.searchParams.set("archived", "include");
  return Response.redirect(url, 303);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Downloads the workspace's directory as CSV. Members only; RLS scopes rows.
// The URL carries no private data, and nothing from the rows is logged.
export async function GET(request: Request) {
  const includeArchived = new URL(request.url).searchParams.get("archived") === "include";
  return exportCsv(request, { includeArchived });
}

// Export Selected (#321): the listings picked in the Directory, sent as a
// form post so a long selection doesn't make a long URL.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const ids = String(form?.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => UUID.test(id));
  if (!ids.length) return new Response("Pick some listings to export.", { status: 400, headers: PRIVATE });
  if (ids.length > MAX_SELECTED)
    return new Response(`Export up to ${MAX_SELECTED} listings at a time.`, { status: 400, headers: PRIVATE });
  return exportCsv(request, { includeArchived: true, ids });
}

async function exportCsv(request: Request, { includeArchived, ids }: { includeArchived: boolean; ids?: string[] }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return new Response("Sign in to export.", { status: 401, headers: PRIVATE });

  const membership = await getMembership().catch(() => null);
  if (!membership) return new Response("Only band members can export.", { status: 403, headers: PRIVATE });

  let csv: string;
  try {
    const rows = await buildExportRows({ includeArchived, ids });
    if (!rows.length) return back(request, "empty", includeArchived && !ids);
    csv = toCsv(rows);
  } catch {
    console.error("CSV export failed");
    return back(request, "failed", includeArchived && !ids);
  }

  const slug =
    membership.workspaceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "band";
  const suffix = ids ? "-selected" : includeArchived ? "-with-archived" : "";
  const filename = `seeens-${slug}-${todayISO(new Date(), membership.timeZone)}${suffix}.csv`;
  // UTF-8 byte order mark so Excel reads accents and emoji correctly.
  return new Response(`﻿${csv}\r\n`, {
    headers: {
      ...PRIVATE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
