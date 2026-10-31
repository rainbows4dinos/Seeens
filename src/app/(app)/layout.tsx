import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { MainNav } from "@/components/main-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header>
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="logo uppercase">
              Seeens
            </Link>
            <MainNav />
          </div>
          <Suspense fallback={<span className="caption">Loading…</span>}>
            <Account />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-16">{children}</main>
      <footer className="rule-top rule-strong bg-surface">
        <p className="caption mx-auto w-full max-w-4xl px-4 py-4 normal-case">
          Town data from{" "}
          <a href="https://www.geonames.org/" className="link" target="_blank" rel="noopener noreferrer">
            GeoNames
          </a>{" "}
          (
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            className="link"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC BY 4.0
          </a>
          ).
        </p>
      </footer>
    </div>
  );
}

async function Account() {
  const user = await getCurrentUser();
  // The header shouldn't take the page down if the workspace can't load;
  // the page's own error state explains what happened.
  const membership = await getMembership().catch(() => null);
  const name = membership?.displayName ?? user.email ?? "you";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {membership ? (
          <>
            <span className="nav-chip bg-inverse text-[var(--color-text-inverse)] hover:bg-inverse">
              {membership.workspaceName}
            </span>
            <span className="text-muted">{name}</span>
          </>
        ) : (
          <span className="text-muted break-all">{name}</span>
        )}
      </p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="button-secondary">
          Sign out
        </button>
      </form>
    </div>
  );
}
