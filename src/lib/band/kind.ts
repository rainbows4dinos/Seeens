// A workspace is a band or a label (#298). Most of Seeens reads the same
// for both; these are the words that change.

export type WorkspaceKind = "band" | "label";

export function kindWords(kind: WorkspaceKind) {
  const label = kind === "label";
  return {
    /** "band" or "label", for the middle of a sentence. */
    noun: label ? "label" : "band",
    /** "Band" or "Label", for Title Case. */
    Noun: label ? "Label" : "Band",
    /** Who else is in it: "your bandmates", or "the people at your label". */
    mates: label ? "the people at your label" : "your bandmates",
    settings: label ? "Label Settings" : "Band Settings",
    page: label ? "Your Label’s Page" : "Your Band’s Page",
  };
}
