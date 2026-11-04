"use client";

// Adding a member to a band (#124): offer the band's town, scenes, and
// "played together" for the new person, all ticked, each easy to untick.
// Nothing is copied silently, and nothing is linked: the person gets their
// own values.

export type Carry = { town: string | null; scenes: { id: string; name: string }[]; playedTogether: boolean };
export type CarryPick = { town: boolean; sceneIds: string[]; played: boolean };

export const hasCarry = (c?: Carry | null): c is Carry =>
  Boolean(c && (c.town || c.scenes.length || c.playedTogether));
export const pickAll = (c: Carry): CarryPick => ({
  town: Boolean(c.town),
  sceneIds: c.scenes.map((s) => s.id),
  played: c.playedTogether,
});

export function CarryFields({
  carry,
  value,
  onChange,
  who,
}: {
  carry: Carry;
  value: CarryPick;
  onChange: (next: CarryPick) => void;
  /** "the new person", "new people" */
  who: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label">From the band</legend>
      <p className="text-sm text-muted">Copied to {who}. Untick anything that doesn&rsquo;t apply.</p>
      <ul className="offer-list flex flex-col gap-2">
        {carry.town ? (
          <li>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={value.town} onChange={(e) => onChange({ ...value, town: e.target.checked })} />
              <span>
                <span className="text-muted">Town: </span>
                {carry.town}
              </span>
            </label>
          </li>
        ) : null}
        {carry.scenes.map((s) => (
          <li key={s.id}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.sceneIds.includes(s.id)}
                onChange={(e) =>
                  onChange({
                    ...value,
                    sceneIds: e.target.checked ? [...value.sceneIds, s.id] : value.sceneIds.filter((x) => x !== s.id),
                  })
                }
              />
              <span>
                <span className="text-muted">Scene: </span>
                {s.name}
              </span>
            </label>
          </li>
        ))}
        {carry.playedTogether ? (
          <li>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={value.played} onChange={(e) => onChange({ ...value, played: e.target.checked })} />
              <span>We&rsquo;ve played together</span>
            </label>
          </li>
        ) : null}
      </ul>
    </fieldset>
  );
}
