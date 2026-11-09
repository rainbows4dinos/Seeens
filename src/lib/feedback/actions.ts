"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { siteOrigin } from "@/lib/origin";
import { appVersion } from "@/lib/feedback/version";
import { cleanPath, describeBrowser, isKind, isStatus, kindLabel, type Status } from "@/lib/feedback/labels";

// Beta feedback (#71). Testers send it; app admins sort it and close the loop.

export type SendState = { error?: string; sent?: boolean };
export type AdminState = { error?: string; done?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sendFeedback(_prev: SendState, formData: FormData): Promise<SendState> {
  const user = await getCurrentUser();
  const membership = await getMembership();
  if (!membership) return { error: "Feedback comes from a band. Ask a bandmate to invite you first." };

  const kind = formData.get("kind");
  const body = String(formData.get("body") ?? "").trim();
  if (!isKind(kind)) return { error: "Pick what kind of feedback it is." };
  if (!body) return { error: "Say what happened, or what you'd like." };
  if (body.length > 4000) return { error: "Keep it under 4,000 characters. Send a second one for the rest." };
  const shot = String(formData.get("screenshot_path") ?? "") || null;

  const supabase = await createClient();
  const userAgent = (await headers()).get("user-agent");
  const { data: id, error } = await supabase.rpc("submit_feedback", {
    p_workspace_id: membership.workspaceId,
    p_kind: kind,
    p_body: body,
    p_path: cleanPath(String(formData.get("path") ?? "")),
    p_app_version: appVersion(),
    p_user_agent: userAgent,
    p_screen: String(formData.get("screen") ?? "").slice(0, 40) || null,
    p_error_digest: String(formData.get("digest") ?? "").slice(0, 100) || null,
    p_screenshot_path: shot,
  });
  if (error || !id) {
    if (error?.message?.includes("too many"))
      return { error: "That's a lot of feedback in an hour. Try again a bit later." };
    return { error: "Couldn't send it. Your text is still here; try again." };
  }

  const origin = await siteOrigin();
  // Tell the admins after the response, so a slow email doesn't hold up the tester.
  after(() =>
    emailAdmins({
      id,
      kind,
      body,
      from: membership.displayName,
      band: membership.workspaceName,
      replyTo: user.email ?? undefined,
      path: cleanPath(String(formData.get("path") ?? "")),
      browser: describeBrowser(userAgent),
      hasShot: Boolean(shot),
      origin,
    }).catch(() => null),
  );
  revalidatePath("/feedback");
  return { sent: true };
}

async function emailAdmins(f: {
  id: string;
  kind: string;
  body: string;
  from: string;
  band: string;
  replyTo?: string;
  path: string | null;
  browser: string;
  hasShot: boolean;
  origin: string;
}) {
  const admin = createAdminClient();
  if (!admin || !emailConfigured()) return;
  const { data: admins } = await admin.from("app_admins").select("user_id");
  for (const a of admins ?? []) {
    const { data } = await admin.auth.admin.getUserById(a.user_id);
    const to = data.user?.email;
    if (!to) continue;
    await sendEmail({
      to,
      replyTo: f.replyTo,
      subject: `Feedback: ${kindLabel(f.kind)} from ${f.from} (${f.band})`,
      text: [
        f.body,
        "",
        `${f.from}, ${f.band}`,
        f.path ? `Page: ${f.path}` : null,
        f.browser,
        f.hasShot ? "With a screenshot." : null,
        "",
        `Open it: ${f.origin}/admin/feedback#f-${f.id}`,
        "Reply to this email to answer them directly.",
      ]
        .filter((l) => l !== null)
        .join("\n"),
    });
  }
}

// ----- Admin -----

async function requireAdmin() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_app_admin");
  return data ? supabase : null;
}

export async function updateFeedback(id: string, status: Status, githubUrl: string): Promise<AdminState> {
  const supabase = await requireAdmin();
  if (!supabase) return { error: "Only app admins can do that." };
  if (!UUID.test(id) || !isStatus(status)) return { error: "Couldn't save. Try again." };
  const url = githubUrl.trim();
  if (url && !/^https:\/\/github\.com\/\S+$/.test(url))
    return { error: "Paste a GitHub link, like https://github.com/…/issues/12." };
  const { error } = await supabase.rpc("update_feedback", { p_id: id, p_status: status, p_github_url: url || null });
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/admin/feedback");
  return { done: "Saved" };
}

/** Tell the tester something they sent is done. Optional, once per item. */
export async function tellTester(id: string, note: string): Promise<AdminState> {
  const supabase = await requireAdmin();
  if (!supabase) return { error: "Only app admins can do that." };
  if (!UUID.test(id)) return { error: "Couldn't send it. Try again." };
  const { data: f } = await supabase
    .from("feedback")
    .select("user_id, sender_name, body, created_at, status, github_url")
    .eq("id", id)
    .maybeSingle();
  if (!f) return { error: "Couldn't find that feedback." };
  if (f.status !== "done") return { error: "Mark it Done first." };
  if (!f.user_id) return { error: "Their account is deleted, so there's no one to tell." };

  const admin = createAdminClient();
  if (!admin || !emailConfigured()) return { error: "Email isn't set up, so this can't send." };
  const { data } = await admin.auth.admin.getUserById(f.user_id);
  const to = data.user?.email;
  if (!to) return { error: "Their account is deleted, so there's no one to tell." };

  const trimmed = note.trim().slice(0, 2000);
  const sent = await sendEmail({
    to,
    subject: "Something you sent Seeens is done",
    text: [
      `Hi ${f.sender_name},`,
      "",
      "You sent Seeens this:",
      "",
      f.body.replace(/^/gm, "> "),
      "",
      "It's done now.",
      trimmed ? `\n${trimmed}` : null,
      "",
      "Thanks for testing Seeens. Keep it coming: Send Feedback is in the header.",
    ]
      .filter((l) => l !== null)
      .join("\n"),
  });
  if (!sent) return { error: "Couldn't send the email. Try again." };
  await supabase.rpc("mark_feedback_notified", { p_id: id });
  revalidatePath("/admin/feedback");
  return { done: `Told ${f.sender_name}.` };
}
