import type { NextRequest } from "next/server";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";

// Signed out only: signed-in visitors go to the directory.
const PUBLIC_PATHS = ["/login", "/forgot-password"];
// Open either way: email links land here signed in or not (#67), and About,
// Seeens & AI, What's New (#216), and the Roadmap (#217) are for people
// who just got an invite.
const OPEN_PATHS = ["/auth/callback", "/about", "/ai", "/changelog", "/roadmap"];

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);
  // Invite links (#69) work signed in or out, and so do the sign-in
  // preview's photos (#255), which check each listing themselves.
  if (OPEN_PATHS.includes(pathname) || pathname.startsWith("/invite/") || pathname.startsWith("/api/preview-photos/"))
    return response;

  if (!userId && !isPublic) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname + search);
    return redirectWithCookies(response, login);
  }

  if (userId && isPublic) {
    return redirectWithCookies(response, new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
