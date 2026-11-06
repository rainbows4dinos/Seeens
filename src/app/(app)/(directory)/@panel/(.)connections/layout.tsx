import type { ReactNode } from "react";
import { QuickViewFrame } from "@/components/quick-view-frame";

// The panel's frame lives above [id], so switching connections swaps what's
// inside without sliding the panel out and back in.
export default function QuickViewLayout({ children }: { children: ReactNode }) {
  return <QuickViewFrame>{children}</QuickViewFrame>;
}
