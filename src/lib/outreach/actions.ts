"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getMembership, requireWorkspaceId } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CHANNELS, isISODate, todayISO, type OutreachChannel } from "./labels";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Outreach log: what already happened. Entries are history; changing the
// plan or status never touches them.

export type OutreachValues = { occurredOn: string; channel: string; summary: string };
export type OutreachState = {
  values: OutreachValues;
  errors: Partial<Record<keyof OutreachValues | "form", string>>;
  attempt?: number;
  savedAt?: number;
};

export async function logOutreach(
  connectionId: string,
  _prev: OutreachState,
  fd: FormData,
): Promise<OutreachState> {
  const values: OutreachValues = {
    occurredOn: str(fd, "occurred_on"),
    channel: str(fd, "channel"),
    summary: str(fd, "summary"),
  };
  const membership = await getMembership();
  if (!membership) return { values, errors: { form: "You're not in a workspace yet." }, attempt: Date.now() };
  // "The future" means after today where the band is.
  const today = todayISO(new Date(), membership.timeZone);

  const errors: OutreachState["errors"] = {};
  if (!isISODate(values.occurredOn)) errors.occurredOn = "Pick the date it happened.";
  else if (values.occurredOn > today) {
    errors.occurredOn = "Outreach is for what already happened. Plan future steps under Next action.";
  } else if (values.occurredOn < "1990-01-01") errors.occurredOn = "That date looks too far back.";
  if (!CHANNELS.includes(values.channel as OutreachChannel)) errors.channel = "Pick how you reached out.";
  if (!values.summary) errors.summary = "Add a short note about what happened.";
  else if (values.summary.length > 4000) errors.summary = "Keep it under 4,000 characters.";
  if (Object.keys(errors).length) return { values, errors, attempt: Date.now() };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("outreach_entries").insert({
    workspace_id: membership.workspaceId,
    connection_id: connectionId,
    occurred_on: values.occurredOn,
    channel: values.channel as OutreachChannel,
    summary: values.summary,
    author_id: user.id,
  });
  if (error) {
    return {
      values,
      errors: { form: "Couldn't save. Your note is still here; try again." },
      attempt: Date.now(),
    };
  }

  revalidatePath("/", "layout");
  return { values: { occurredOn: today, channel: values.channel, summary: "" }, errors: {}, savedAt: Date.now() };
}

// Only the author can remove an entry (enforced by RLS).
export async function removeOutreach(id: string): Promise<{ error?: string }> {
  const [supabase, workspaceId] = await Promise.all([createClient(), requireWorkspaceId()]);
  const { data, error } = await supabase
    .from("outreach_entries")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id");
  if (error || !data.length) return { error: "Couldn't remove that entry. Try again." };
  revalidatePath("/", "layout");
  return {};
}

// ---------------------------------------------------------------------------
// Next action: the current plan. One open per connection; replacing,
// finishing, or dropping it keeps the old one as history.

export type NextActionValues = { description: string; dueOn: string; assigneeId: string };
export type NextActionState = {
  values: NextActionValues;
  errors: Partial<Record<keyof NextActionValues | "form", string>>;
  attempt?: number;
  savedAt?: number;
};

export async function setNextAction(
  connectionId: string,
  _prev: NextActionState,
  fd: FormData,
): Promise<NextActionState> {
  const values: NextActionValues = {
    description: str(fd, "description"),
    dueOn: str(fd, "due_on"),
    assigneeId: str(fd, "assignee_id"),
  };
  const errors: NextActionState["errors"] = {};
  if (!values.description) errors.description = "Say what the next step is.";
  else if (values.description.length > 1000) errors.description = "Keep it under 1,000 characters.";
  if (values.dueOn && !isISODate(values.dueOn)) errors.dueOn = "Use a real date, or leave it empty.";
  if (values.assigneeId && !UUID_RE.test(values.assigneeId)) errors.assigneeId = "Pick someone in the band.";
  if (Object.keys(errors).length) return { values, errors, attempt: Date.now() };

  const [supabase, workspaceId] = await Promise.all([createClient(), requireWorkspaceId()]);
  // On this band's layer, whoever added the record (#185).
  const { error } = await supabase.rpc("set_next_action", {
    p_workspace_id: workspaceId,
    p_connection_id: connectionId,
    p_description: values.description,
    p_due_on: values.dueOn || undefined,
    p_assignee_id: values.assigneeId || undefined,
  });
  if (error) {
    return {
      values,
      errors:
        error.code === "23503"
          ? { assigneeId: "Pick someone in the band." }
          : { form: "Couldn't save the plan. Your text is still here; try again." },
      attempt: Date.now(),
    };
  }

  revalidatePath("/", "layout");
  return { values, errors: {}, savedAt: Date.now() };
}

export async function closeNextAction(id: string, how: "done" | "dropped"): Promise<{ error?: string }> {
  if (how !== "done" && how !== "dropped") return { error: "Something went wrong." };
  const [supabase, workspaceId] = await Promise.all([createClient(), requireWorkspaceId()]);
  const { data, error } = await supabase
    .from("next_actions")
    .update({ status: how })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .eq("status", "open")
    .select("id");
  if (error || !data.length) return { error: "Couldn't update the plan. Try again." };
  revalidatePath("/", "layout");
  return {};
}
