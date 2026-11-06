"use server";

import { cookies, headers } from "next/headers";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// Account settings (#67). Email and password changes go through Supabase
// Auth; nothing sensitive is kept in app tables.

export type FormState = { error?: string; done?: string };

const MIN_PASSWORD = 8;

/** This site's origin, for links in emails (auth callback). */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function rateLimited(error: { status?: number; code?: string }) {
  return error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit";
}

export async function updateDisplayName(name: string): Promise<FormState> {
  await getCurrentUser();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Add a name." };
  if (trimmed.length > 80) return { error: "Keep it under 80 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_display_name", { p_name: trimmed });
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/", "layout");
  return { done: "Saved" };
}

export async function changeEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter an email address, like you@example.com." };
  if (email === user.email?.toLowerCase()) return { error: "That's already your email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent("/account?email=changed")}` },
  );
  if (error) {
    if (error.code === "email_exists") return { error: "Another account already uses that email." };
    if (rateLimited(error)) return { error: "Too many emails just now. Wait a few minutes and try again." };
    return { error: "Couldn't send the link. Try again." };
  }
  // Supabase can also ask the current address to confirm (secure email
  // change), so mention both inboxes.
  return {
    done: `Check ${email} for a link, and ${user.email ?? "your current email"} too if one arrives there. Your email stays the same until you open it.`,
  };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  if (!current) return { error: "Enter your current password." };
  if (next.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };
  if (next !== confirm) return { error: "The new passwords don't match." };
  if (!user.email) return { error: "Couldn't change it. Try again." };

  const supabase = await createClient();
  // Supabase doesn't check the old password on its own, so sign in with it
  // first. That also counts as a fresh sign-in for the change.
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) {
    if (rateLimited(check.error)) return { error: "Too many tries. Wait a minute and try again." };
    return { error: "That's not your current password." };
  }
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    if (error.code === "same_password") return { error: "That's your current password. Pick a new one." };
    if (error.code === "weak_password") return { error: "Pick a stronger password." };
    return { error: "Couldn't change it. Try again." };
  }
  return { done: "Password changed." };
}

export async function signOutOtherDevices(): Promise<FormState> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: "Couldn't sign out the others. Try again." };
  return { done: "Signed out everywhere else." };
}

export async function leaveBand(workspaceId: string): Promise<FormState> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_workspace", { p_workspace_id: workspaceId });
  if (error) {
    if (error.message?.includes("last owner")) {
      return { error: "You're the only owner. Make someone else an owner first." };
    }
    return { error: "Couldn't leave. Try again." };
  }
  revalidatePath("/", "layout");
  redirect("/account?left=1");
}

// Forgot password, from Sign In. Says the same thing whether or not there's
// an account, so it can't be used to find out who has one.
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter your email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  if (error && rateLimited(error)) return { error: "Too many emails just now. Wait a few minutes and try again." };
  return { done: `If there's an account for ${email}, we sent it a link. It works for an hour.` };
}

// The page a reset link lands on: a new password, no old one needed.
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const jar = await cookies();
  if (!jar.get(RECOVERY_COOKIE)) return { error: "This link has run out. Ask for a new one from Sign In." };
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  if (next.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };
  if (next !== confirm) return { error: "The passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    if (error.code === "weak_password") return { error: "Pick a stronger password." };
    return { error: "Couldn't set it. Open the link from your email again." };
  }
  jar.delete(RECOVERY_COOKIE);
  redirect("/account?password=reset");
}
