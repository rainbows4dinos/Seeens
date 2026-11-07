import { ArrowLeft } from "@carbon/icons-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PinWatch } from "@/components/pin-watch";
import { PinnedName } from "@/components/pinned-name";

// Back to the directory from a profile or Add (#126): a secondary button
// with a left arrow that stays pinned under the header as the page scrolls.
// On a profile, once the big name has scrolled away, a small one joins the
// button so you still know whose page this is. `end` pins a control to the
// right of the column, in line with the button (a profile's Keep Private).
export function BackButton({
  href,
  label = "Back to Directory",
  name,
  end,
}: {
  href: string;
  label?: string;
  /** The profile's name, and the id of its big heading to watch. */
  name?: { text: string; headingId: string };
  end?: ReactNode;
}) {
  return (
    <div className="back-pin">
      <div className="back-pin-lead">
        <Link href={href} className="button-secondary whitespace-nowrap">
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="back-label">{label}</span>
        </Link>
        {name ? <PinnedName headingId={name.headingId}>{name.text}</PinnedName> : null}
      </div>
      {end ? <div className="back-pin-end">{end}</div> : null}
      <PinWatch selector=".back-pin" />
    </div>
  );
}
