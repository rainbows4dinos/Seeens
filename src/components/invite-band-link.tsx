import Link from "next/link";

type Listing = {
  id: string;
  name: string;
  kind: string;
  group_type: string | null;
  is_us: boolean;
  keep_private: boolean;
};

// For app admins (#68): invite a band straight from its listing, when
// nobody's claimed it yet. Opens the Bands page with it picked.
export function InviteBandLink({ connection: c }: { connection: Listing }) {
  if (
    c.kind !== "group" ||
    c.group_type !== "band" ||
    c.is_us ||
    c.keep_private
  )
    return null;
  return (
    <div className="pt-2">
      <Link href={`/admin/bands?band=${c.id}`} className="button-secondary">
        Invite {c.name}
      </Link>
    </div>
  );
}
