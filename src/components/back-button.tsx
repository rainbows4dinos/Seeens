import { ArrowLeft } from "@carbon/icons-react";
import Link from "next/link";
import { PinWatch } from "@/components/pin-watch";

// Back to the directory from a profile or Add (#126): a secondary button
// with a left arrow that stays pinned under the header as the page scrolls.
export function BackButton({ href, label = "Back to Directory" }: { href: string; label?: string }) {
  return (
    <div className="back-pin">
      <Link href={href} className="button-secondary">
        <ArrowLeft size={16} aria-hidden="true" />
        {label}
      </Link>
      <PinWatch selector=".back-pin" />
    </div>
  );
}
