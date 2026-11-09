import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";

// Where links in Supabase emails land (#67): password reset and email
// change. A PKCE link brings ?code=; a token link brings ?token_hash= and
// ?type=. Either way, finish signing in and go on to ?next (a path here).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  if (!ok) {
    const login = new URL("/login", request.url);
    login.searchParams.set("link", "expired");
    return NextResponse.redirect(login);
  }

  const res = NextResponse.redirect(new URL(next, request.url));
  // A reset link lets you set a password without the old one, once, for a
  // few minutes. Only a link that just worked can open that page.
  if (next === "/reset-password") {
    res.cookies.set(RECOVERY_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      maxAge: 15 * 60,
      path: "/",
    });
  }
  return res;
}

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
