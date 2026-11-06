import { Suspense } from "react";
import { QuickView } from "@/components/quick-view";

// A connection opened from the directory: the quick view panel (#126), in
// the frame from the layout above. Loaded directly (a refresh, a shared
// link), /connections/[id] shows the full page instead.
export default function QuickViewPage({ params }: PageProps<"/connections/[id]">) {
  return (
    <Suspense fallback={<p className="quick-view-body text-muted">Loading…</p>}>
      <QuickView params={params} />
    </Suspense>
  );
}
