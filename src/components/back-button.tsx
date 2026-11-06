import { ArrowLeft } from "@carbon/icons-react";
import Link from "next/link";
import { PinWatch } from "@/components/pin-watch";
import { PinnedName } from "@/components/pinned-name";

// Back to the directory from a profile or Add (#126): a secondary button
// with a left arrow that stays pinned under the header as the page scrolls.
// On a profile, once the big name has scrolled away, a small one joins the
// button so you still know whose page this is.
export function BackButton({
  href,
  label = "Back to Directory",
  name,
}: {
  href: string;
  label?: string;
  /** The profile's name, and the id of its big heading to watch. */
  name?: { text: string; headingId: string };
}) {
  return (
    <div className="back-pin">
      <Link href={href} className="button-secondary whitespace-nowrap">
        <ArrowLeft size={16} aria-hidden="true" />
        <span className="back-label">{label}</span>
      </Link>
      {name ? <PinnedName headingId={name.headingId}>{name.text}</PinnedName> : null}
      <PinWatch selector=".back-pin" />
    </div>
  );
}
