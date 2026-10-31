import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { buildExportRows } from "@/lib/export/build";
import { toCsv } from "@/lib/export/csv";
import { todayISO } from "@/lib/outreach/labels";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

function back(request: Request, reason: "empty" | "failed", archived: boolean) {
  const url = new URL("/export", request.url);
  url.searchParams.set("problem", reason);
  if (archived) url.searchParams.set("archived", "include");
  return Response.redirect(url, 303);
}

// Downloads the workspace's directory as CSV. Members only; RLS scopes rows.
// The URL carries no private data, and nothing from the rows is logged.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return new Response("Sign in to export.", { status: 401, headers: PRIVATE });

  const membership = await getMembership().catch(() => null);
  if (!membership) return new Response("Only band members can export.", { status: 403, headers: PRIVATE });

  const includeArchived = new URL(request.url).searchParams.get("archived") === "include";
  let csv: string;
  try {
    const rows = await buildExportRows({ includeArchived });
    if (!rows.length) return back(request, "empty", includeArchived);
    csv = toCsv(rows);
  } catch {
    console.error("CSV export failed");
    return back(request, "failed", includeArchived);
  }

  const slug = membership.workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "band";
  const filename = `seeens-${slug}-${todayISO()}${includeArchived ? "-with-archived" : ""}.csv`;
  // UTF-8 byte order mark so Excel reads accents and emoji correctly.
  return new Response(`﻿${csv}\r\n`, {
    headers: {
      ...PRIVATE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
