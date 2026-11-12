// The invite emails, in one place so they read alike. Plain text.
//
// - Say what Seeens is for in terms of a show or a tour, not features.
// - No possessive on a band's name: "The Snubs's" reads wrong, so it's
//   "your band's listing".
// - Replies go to whoever sent it, and the email says so.

import type { WorkspaceKind } from "@/lib/band/kind";

const STOP = `Don't want email from Seeens? Open the link and choose "Don't email me again."`;

/** An owner's invite: from an admin, or from a label inviting a band on its roster. */
export function ownerInvite(o: {
  /** Who it's from, as the opening line names them: "Larry", or "Tim at Moodkiller Records". */
  from: string;
  /** Who a reply goes to. */
  replyName: string;
  band: string;
  kind: WorkspaceKind;
  name: string;
  link: string;
}) {
  const label = o.kind === "label";
  return {
    subject: `${o.from} invited ${o.band} to Seeens`,
    text: [
      o.name ? `Hi ${o.name},` : "Hi,",
      "",
      `${o.from} invited ${o.band} to Seeens and made you its owner.`,
      "",
      label
        ? "Seeens is a directory bands and labels keep together: the bands, venues, bookers, and labels you know, and who else knows them. When a release needs shows, you can see who's played where and who can make an intro."
        : "Seeens is a directory bands keep together: the venues, bookers, labels, and bands you know, and who else knows them. When you're planning a show or a tour, you can see who's played where and who can make an intro.",
      "",
      `It's in beta and invite only, so you'd be one of the first ${label ? "labels" : "bands"} on it. Tell us what's missing.`,
      "",
      `Join here: ${o.link}`,
      "The link works once, for 7 days.",
      "",
      label
        ? "Once you're in, your label's listing is yours to keep up to date, and you can invite the people you work with from Label Settings."
        : "Once you're in, your band's listing is yours to keep up to date, and you can invite your bandmates from Band Settings.",
      "",
      `Questions? Just reply. It goes to ${o.replyName}.`,
      "",
      STOP,
    ].join("\n"),
  };
}

/** A member inviting someone into their band (or label). */
export function memberInvite(o: { from: string; band: string; kind: WorkspaceKind; link: string }) {
  const label = o.kind === "label";
  return {
    subject: `${o.from} invited you to ${o.band} on Seeens`,
    text: [
      `${o.from} invited you to ${o.band} on Seeens.`,
      "",
      label
        ? `It's where ${o.band} keeps track of the bands, venues, and bookers you all work with: who's played where, who to ask about what, and what's next.`
        : `It's where ${o.band} keeps track of the venues, bookers, and bands you all know: who you've played with, who books what, and what's next. Anyone in the band can add to it, so nobody has to remember it all.`,
      "",
      `Join ${o.band}: ${o.link}`,
      "The link works once, for 7 days.",
      "",
      STOP,
    ].join("\n"),
  };
}
