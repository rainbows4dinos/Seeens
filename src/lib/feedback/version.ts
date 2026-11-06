import "server-only";

/** The commit this deploy runs, short. "dev" locally. */
export function appVersion() {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
}
