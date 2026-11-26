// A workspace is a band, a label (#298), or a promoter (#304). Most of
// Seeens reads the same for all three; these are the words that change.

export type WorkspaceKind = "band" | "label" | "promoter";

/** A workspace's kind from the database; anything else reads as a band. */
export function toKind(v: unknown): WorkspaceKind {
  return v === "label" || v === "promoter" ? v : "band";
}

/** A group type's workspace kind: the listing a workspace claims. */
export function kindForGroupType(t: string | null | undefined): WorkspaceKind | null {
  return t === "band" ? "band" : t === "label" ? "label" : t === "promoter_collective" ? "promoter" : null;
}

const WORDS = {
  band: {
    noun: "band",
    Noun: "Band",
    mates: "your bandmates",
    settings: "Band Settings",
    page: "Your Band’s Page",
  },
  label: {
    noun: "label",
    Noun: "Label",
    mates: "the people at your label",
    settings: "Label Settings",
    page: "Your Label’s Page",
  },
  promoter: {
    noun: "promoter",
    Noun: "Promoter",
    mates: "the people you promote with",
    settings: "Promoter Settings",
    page: "Your Promoter Page",
  },
} satisfies Record<WorkspaceKind, Record<string, string>>;

/**
 * noun: "band", for the middle of a sentence. Noun: "Band", for Title Case.
 * mates: who else is in it. settings and page: what those are called.
 */
export function kindWords(kind: WorkspaceKind) {
  return WORDS[kind];
}
