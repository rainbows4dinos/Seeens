// Beta feedback (#71): words for kinds and statuses, the context line a
// tester sees before sending, and the GitHub issue draft. No imports, so the
// unit tests run it directly.

export const KINDS = [
  { value: "bug", label: "Bug", hint: "Something broke or looks wrong." },
  { value: "idea", label: "Idea", hint: "Something Seeens could do." },
  { value: "confusing", label: "Confusing", hint: "You weren't sure what to do or what it meant." },
  { value: "other", label: "Other", hint: "Anything else." },
] as const;
export type Kind = (typeof KINDS)[number]["value"];
export const isKind = (v: unknown): v is Kind => KINDS.some((k) => k.value === v);
export const kindLabel = (v: string) => KINDS.find((k) => k.value === v)?.label ?? "Other";

export const STATUSES = [
  { value: "new", label: "New" },
  { value: "looking", label: "Looking" },
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
  { value: "wont_do", label: "Won't Do" },
] as const;
export type Status = (typeof STATUSES)[number]["value"];
export const isStatus = (v: unknown): v is Status => STATUSES.some((s) => s.value === v);
export const statusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? "New";

/** The path only: a query string can hold names someone searched for. */
export function cleanPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  const path = value.split(/[?#]/)[0];
  return path.length <= 300 ? path : null;
}

/** "Chrome 130 on macOS" from a user agent, for people to read. The full string is kept too. */
export function describeBrowser(ua: string | null | undefined): string {
  if (!ua) return "Unknown browser";
  const pick = (re: RegExp) => ua.match(re)?.[1]?.split(".")[0];
  const browser =
    (pick(/Edg\/([\d.]+)/) && `Edge ${pick(/Edg\/([\d.]+)/)}`) ||
    (pick(/Firefox\/([\d.]+)/) && `Firefox ${pick(/Firefox\/([\d.]+)/)}`) ||
    (pick(/CriOS\/([\d.]+)/) && `Chrome ${pick(/CriOS\/([\d.]+)/)}`) ||
    (pick(/Chrome\/([\d.]+)/) && `Chrome ${pick(/Chrome\/([\d.]+)/)}`) ||
    (/Safari\//.test(ua) && pick(/Version\/([\d.]+)/) && `Safari ${pick(/Version\/([\d.]+)/)}`) ||
    "A browser";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return os ? `${browser} on ${os}` : browser;
}

type DraftSource = {
  kind: string;
  body: string;
  path: string | null;
  app_version: string | null;
  user_agent: string | null;
  screen: string | null;
  error_digest: string | null;
};

const REPO = "https://github.com/rainbows4dinos/seeens";

/**
 * A new-issue page on GitHub with the text filled in, for Larry to edit
 * before posting. The tester's name and band stay out of it.
 */
export function issueDraftUrl(f: DraftSource): string {
  const firstLine = f.body.trim().split("\n")[0].trim();
  const title = `${kindLabel(f.kind)}: ${firstLine.length > 72 ? `${firstLine.slice(0, 71)}…` : firstLine}`;
  const context = [
    f.path ? `- Page: \`${f.path}\`` : null,
    f.app_version ? `- Version: ${f.app_version}` : null,
    f.user_agent ? `- Browser: ${describeBrowser(f.user_agent)}` : null,
    f.screen ? `- Screen: ${f.screen}` : null,
    f.error_digest ? `- Error reference: ${f.error_digest}` : null,
  ].filter(Boolean);
  // Long feedback is cut so the link stays under browser limits.
  const text = f.body.trim().length > 3000 ? `${f.body.trim().slice(0, 3000)}…` : f.body.trim();
  const body = [
    "From beta feedback.",
    "",
    text.replace(/^/gm, "> "),
    ...(context.length ? ["", ...context] : []),
  ].join("\n");
  const labels = f.kind === "bug" ? "bug" : f.kind === "idea" ? "enhancement" : "";
  const params = new URLSearchParams({ title, body, ...(labels ? { labels } : {}) });
  return `${REPO}/issues/new?${params.toString()}`;
}
