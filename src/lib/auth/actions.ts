"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  error?: string;
  email?: string;
};

// Only allow redirects to paths inside this app.
function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}

export async function signIn(_prev: SignInState | undefined, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "That email and password don't match."
        : error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Couldn't sign in right now. Try again in a moment.";
    return { error: message, email };
  }

  redirect(safeNext(formData.get("next")));
}
