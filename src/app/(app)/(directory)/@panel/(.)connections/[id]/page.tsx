import { Suspense } from "react";
import { QuickView } from "@/components/quick-view";
import { QuickViewFrame } from "@/components/quick-view-frame";

// A connection opened from the directory: the quick view panel (#126).
// Loaded directly (a refresh, a shared link), /connections/[id] shows the
// full page instead.
export default function QuickViewPage({ params }: PageProps<"/connections/[id]">) {
  return (
    <QuickViewFrame>
      <Suspense fallback={<p className="quick-view-body text-muted">Loading…</p>}>
        <QuickView params={params} />
      </Suspense>
    </QuickViewFrame>
  );
}
