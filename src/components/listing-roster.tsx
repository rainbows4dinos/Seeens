import { createClient } from "@/lib/supabase/server";
import { Print } from "@/components/home";
import { ProfilePanel } from "@/components/profile/panel";

// A label listing's roster (#357), for anyone looking at it: the bands any
// band has linked as on the label, current first. Being on a label is a
// shared fact, so this isn't one band's view.
export async function ListingRoster({ id, label }: { id: string; label: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("listing_roster", { p_connection_id: id });
  const bands = data ?? [];
  if (!bands.length) return null;
  const current = bands.filter((b) => b.is_current).length;
  return (
    <ProfilePanel
      id="roster"
      title="Roster"
      summary={`${current} ${current === 1 ? "band" : "bands"} on ${label}${bands.length > current ? `, ${bands.length - current} past` : ""}`}
    >
      <ul className="home-shelf">
        {bands.map((b) => (
          <li key={b.connection_id}>
            <a href={`/connections/${b.connection_id}`} className="home-shelf-item">
              <Print name={b.name} path={b.photo_path} size="m" />
              <span className="block truncate text-sm font-medium">{b.name}</span>
              {b.is_current ? null : <span className="caption block truncate">Past</span>}
            </a>
          </li>
        ))}
      </ul>
    </ProfilePanel>
  );
}
