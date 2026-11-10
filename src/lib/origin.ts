import "server-only";
import { headers } from "next/headers";

/**
 * This site's origin, for links in emails. A fixed address when there is one,
 * so a forged Host header can't point an email's links somewhere else:
 * SITE_URL if set, else the production domain Vercel provides. Previews and
 * local dev use the request's own host.
 */
export async function siteOrigin() {
  const fixed = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
