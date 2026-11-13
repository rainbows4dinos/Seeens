import type { CSSProperties } from "react";
import { GROUP_TYPE_LABELS } from "@/lib/connections/labels";
import { catalogNo, initials } from "@/lib/connections/card";
import type { PreviewCard } from "@/lib/preview/cards";
import { Photo } from "@/components/photo";

// The sign-in page's preview (#255): columns of real cards drifting up,
// like flipping through a crate. Names, towns, scenes, and photos only;
// nothing from any band's own notes. Decorative, so screen readers skip it,
// and with reduced motion it holds still.
export function PreviewWall({ cards }: { cards: PreviewCard[] }) {
  // Two columns, or three on wide screens: both are drawn and CSS shows the
  // one that fits, so every card has a place either way. Photos in the
  // hidden one never load (lazy).
  return (
    <>
      <Columns cards={cards} count={2} />
      <Columns cards={cards} count={3} />
    </>
  );
}

function Columns({ cards, count }: { cards: PreviewCard[]; count: number }) {
  const columns = Array.from({ length: count }, (_, n) => cards.filter((_, i) => i % count === n));
  return (
    <div className="preview-wall" data-columns={count} aria-hidden="true">
      {columns.map((col, i) =>
        col.length ? (
          <div
            key={i}
            className="preview-column"
            // About 8s a card, each column a little slower than the last, so they drift apart.
            style={{ "--preview-duration": `${col.length * (8 + i * 1.5)}s` } as CSSProperties}
          >
            {/* Twice over, so the loop has no seam. */}
            <div className="preview-track">
              {[...col, ...col].map((c, j) => (
                <Card key={`${c.id}-${j}`} card={c} />
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function Card({ card: c }: { card: PreviewCard }) {
  const type = { kind: "group" as const, group_type: c.group_type, person_roles: [], catalog_no: c.catalog_no };
  const tags = [c.town, ...c.scenes].filter((t): t is string => Boolean(t)).slice(0, 3);
  return (
    <div className="connection-card preview-card">
      <span className="card-print">
        <span className="card-print-initials">{initials(c.name)}</span>
        {/* The copier's light bar sweeps while it loads, like cards in the app. */}
        <Photo
          src={`/api/preview-photos/${c.id}?w=320`}
          srcSet={`/api/preview-photos/${c.id}?w=320 320w, /api/preview-photos/${c.id}?w=640 640w`}
          sizes="(min-width: 64rem) 25vw, 0px"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className="tape tape-cyan card-tape" />
      <span className="card-meta">
        <span className="caption flex items-start justify-between gap-3">
          <span>{GROUP_TYPE_LABELS[c.group_type]}</span>
          <span className="shrink-0 whitespace-nowrap">{catalogNo(type)}</span>
        </span>
        <span className="display-s break-words">{c.name}</span>
        {tags.length ? (
          <span className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </div>
  );
}
