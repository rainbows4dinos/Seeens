import { createClient } from "@/lib/supabase/server";
import { Print } from "@/components/home";
import { ProfilePanel } from "@/components/profile/panel";
import { RosterAdd, RosterRemove } from "@/components/roster-add";

// A label listing's roster (#357), for anyone looking at it: the bands any
// band has linked as on the label, current first. Being on a label is a
// shared fact, so this isn't one band's view. On the label's own page, its
// members add bands here and take off ones they added (#365).
export async function ListingRoster({ id, label, manage = false }: { id: string; label: string; manage?: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("listing_roster", { p_connection_id: id });
  const bands = data ?? [];
  if (!bands.length && !manage) return null;
  const current = bands.filter((b) => b.is_current).length;
  return (
    <ProfilePanel
      id="roster"
      title="Roster"
      summary={
        bands.length
          ? `${current} ${current === 1 ? "band" : "bands"} on ${label}${bands.length > current ? `, ${bands.length - current} past` : ""}`
          : "No bands yet"
      }
    >
      <div className="flex flex-col gap-6">
        {bands.length ? (
          <ul className="home-shelf">
            {bands.map((b) => (
              <li key={b.connection_id} className="flex flex-col gap-1">
                <a href={`/connections/${b.connection_id}`} className="home-shelf-item">
                  <Print name={b.name} path={b.photo_path} size="m" />
                  <span className="block truncate text-sm font-medium">{b.name}</span>
                  {b.is_current ? null : <span className="caption block truncate">Past</span>}
                </a>
                {manage && b.added_here ? <RosterRemove id={b.connection_id} name={b.name} /> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {manage ? <RosterAdd label={label} onRoster={bands.map((b) => b.connection_id)} /> : null}
      </div>
    </ProfilePanel>
  );
}
