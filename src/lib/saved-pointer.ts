// Where the mouse was as the page went away (#200). A reload with the
// keyboard leaves the mouse where it was, so after one the busy pointer can
// carry the metronome straight away instead of the page loader.

export const POINTER_KEY = "seeens:pointer";
const FRESH_MS = 15000;

export function readSavedPointer(): { x: number; y: number } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(POINTER_KEY) ?? "null");
    return saved && Date.now() - saved.t < FRESH_MS ? { x: saved.x, y: saved.y } : null;
  } catch {
    return null;
  }
}

/** Runs in <head>, before the first paint: a page loader streamed in before
 * the app starts already leaves its metronome to the pointer. */
export const RESTORE_POINTER_SCRIPT = `try{var s=JSON.parse(sessionStorage.getItem("${POINTER_KEY}")||"null");if(s&&Date.now()-s.t<${FRESH_MS}&&matchMedia("(hover: hover) and (pointer: fine)").matches&&!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.setAttribute("data-mouse","")}catch(e){}`;
