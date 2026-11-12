"use client";

import { useEffect } from "react";
import { markChangelogSeen } from "@/lib/changelog-actions";

// On What's New: once it's open, the header's mark goes away (#216).
export function MarkSeen() {
  useEffect(() => {
    markChangelogSeen().catch(() => {});
  }, []);
  return null;
}
