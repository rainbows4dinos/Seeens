import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { latestChangelogDate } from "@/lib/changelog";

// The header's What's New mark (#216): only while there's an entry this
// person hasn't seen. Opening the page clears it.
export async function WhatsNewMark({ className }: { className: string }) {
  const latest = await latestChangelogDate();
  if (!latest) return null;
  const supabase = await createClient();
  const { data: seen } = await supabase.rpc("changelog_seen_on");
  if (seen && seen >= latest) return null;
  return (
    <Link href="/changelog" className={`${className} whats-new`}>
      <span className="whats-new-dot" aria-hidden="true" />
      What&rsquo;s New
    </Link>
  );
}
