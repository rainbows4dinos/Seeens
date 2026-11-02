import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-4 py-10">
      <h1 className="display-l sm:display-xl">Nothing here.</h1>
      <p className="text-muted">
        This page could not be found. It may have been removed, or the link is off by a character.
      </p>
      <Link href="/" className="button-secondary">
        Back to the Directory
      </Link>
    </main>
  );
}
