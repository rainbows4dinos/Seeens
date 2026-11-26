import "server-only";
import { revalidatePath } from "next/cache";

// After a save, refresh everything (#377). Narrower paths were looked at and
// don't pay off on Next 16.4:
//
// - Pages here read per-request data (cookies), so the browser refetches them
//   on every navigation anyway (staleTimes.dynamic is off by default).
// - Any revalidatePath from a server action already makes every previously
//   visited page refresh on its next visit, whatever path it names. The Next
//   docs call that temporary; when it changes, this is the one place to
//   narrow it.
// - The few cached reads (changelog, roadmap, sign-in preview cards) are
//   cheap to rebuild.
//
// What a save does cost is re-rendering the page you're on, which keeps
// server-drawn parts (a name heading, status history) right. That's worth
// it at this size; revisit when more bands join.
export function refreshAfterSave() {
  revalidatePath("/", "layout");
}
