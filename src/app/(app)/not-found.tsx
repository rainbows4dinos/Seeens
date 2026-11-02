import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="display-l sm:display-xl">Nothing here.</h1>
      <p className="text-muted">
        This page could not be found. It may have been removed, archived out of view, or the link is off by a
        character.
      </p>
      <Link href="/" className="button-secondary">
        Back to the Directory
      </Link>
    </div>
  );
}
