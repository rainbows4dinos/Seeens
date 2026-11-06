import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/connections/labels";
import {
  KINDS,
  STATUSES,
  describeBrowser,
  isKind,
  isStatus,
  issueDraftUrl,
  kindLabel,
  statusLabel,
} from "@/lib/feedback/labels";
import { FeedbackControls } from "./feedback-controls";

export const metadata: Metadata = { title: "Feedback Inbox · Seeens" };

// The feedback inbox (#71), for app admins: everything testers sent, newest
// first, to sort and answer. Nobody else can load it.
export default function FeedbackInboxPage({ searchParams }: PageProps<"/admin/feedback">) {
  return (
    <div className="page-measure flex flex-col gap-8">
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Inbox searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const UUID = /^[0-9a-f-]{36}$/;

async function Inbox({ searchParams }: { searchParams: PageProps<"/admin/feedback">["searchParams"] }) {
  const supabase = await createClient();
  const [{ data: admin }, membership, sp] = await Promise.all([supabase.rpc("is_app_admin"), getMembership(), searchParams]);
  if (!admin) notFound();
  const tz = membership?.timeZone ?? "America/Los_Angeles";

  const kind = one(sp.kind);
  const status = one(sp.status);
  const tester = one(sp.tester);
  let query = supabase
    .from("feedback")
    .select(
      "id, user_id, sender_name, band_name, kind, body, path, app_version, user_agent, screen, error_digest, screenshot_path, status, github_url, notified_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (isKind(kind)) query = query.eq("kind", kind);
  if (isStatus(status)) query = query.eq("status", status);
  if (tester && UUID.test(tester)) query = query.eq("user_id", tester);
  const [{ data: items }, { data: senders }, { data: open }] = await Promise.all([
    query,
    supabase.from("feedback").select("user_id, sender_name").not("user_id", "is", null),
    supabase.from("feedback").select("id").eq("status", "new"),
  ]);
  const testers = [...new Map((senders ?? []).map((s) => [s.user_id!, s.sender_name])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const filtered = isKind(kind) || isStatus(status) || Boolean(tester);

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="caption">App Admin</p>
        <h1 className="display-l">Feedback Inbox</h1>
        <p className="text-muted">
          {open?.length ?? 0} new. Everything testers sent, newest first. Only app admins see this page.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter feedback">
        <div className="flex flex-col gap-2">
          <label htmlFor="f-kind" className="label">
            Kind
          </label>
          <select id="f-kind" name="kind" className="field w-40" defaultValue={isKind(kind) ? kind : ""}>
            <option value="">All</option>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="f-status" className="label">
            Status
          </label>
          <select id="f-status" name="status" className="field w-40" defaultValue={isStatus(status) ? status : ""}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="f-tester" className="label">
            Tester
          </label>
          <select id="f-tester" name="tester" className="field w-48" defaultValue={tester ?? ""}>
            <option value="">Everyone</option>
            {testers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button-secondary">
          Show
        </button>
        {filtered ? (
          <Link href="/admin/feedback" className="link self-center text-sm">
            Clear
          </Link>
        ) : null}
      </form>

      {items?.length ? (
        <ul className="flex flex-col gap-6">
          {items.map((f) => (
            <li key={f.id} id={`f-${f.id}`} className="window flex scroll-mt-28 flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="tag">{statusLabel(f.status)}</span>
                <span className="font-medium">{kindLabel(f.kind)}</span>
                <span className="text-muted">
                  from {f.sender_name}
                  {f.band_name ? ` (${f.band_name})` : ""}
                  {f.user_id ? "" : ", account deleted"} · {formatDate(f.created_at, tz)}
                </span>
              </div>
              <p className="break-words whitespace-pre-line">{f.body}</p>
              {f.screenshot_path ? (
                <a href={`/api/feedback-screenshots/${f.screenshot_path}`} target="_blank" rel="noopener" className="self-start">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, served by our own route */}
                  <img
                    src={`/api/feedback-screenshots/${f.screenshot_path}`}
                    alt={`Screenshot from ${f.sender_name}`}
                    className="max-h-64 max-w-full border border-strong"
                    loading="lazy"
                  />
                </a>
              ) : null}
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                {f.path ? (
                  <>
                    <dt className="text-muted">Page</dt>
                    <dd className="break-all">{f.path}</dd>
                  </>
                ) : null}
                {f.error_digest ? (
                  <>
                    <dt className="text-muted">Error</dt>
                    <dd className="break-all">{f.error_digest}</dd>
                  </>
                ) : null}
                <dt className="text-muted">Browser</dt>
                <dd title={f.user_agent ?? undefined}>{describeBrowser(f.user_agent)}</dd>
                {f.screen ? (
                  <>
                    <dt className="text-muted">Window</dt>
                    <dd>{f.screen}</dd>
                  </>
                ) : null}
                <dt className="text-muted">Version</dt>
                <dd>{f.app_version ?? "Unknown"}</dd>
              </dl>
              <FeedbackControls
                id={f.id}
                status={f.status}
                githubUrl={f.github_url ?? ""}
                draftUrl={issueDraftUrl(f)}
                sender={f.sender_name}
                canTell={Boolean(f.user_id)}
                toldOn={f.notified_at ? formatDate(f.notified_at, tz) : null}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">{filtered ? "Nothing matches." : "No feedback yet."}</p>
      )}
    </>
  );
}
