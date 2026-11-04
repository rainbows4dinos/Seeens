import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getCurrentUser, getMembership } from "@/lib/auth/dal";
import { MainNav } from "@/components/main-nav";
import { MobileMenu } from "@/components/mobile-menu";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header>
        {/* Desktop: logo, nav chips, and the account on one row. Phones: logo
            and a Menu button; the nav and account move into the menu. */}
        <div className="page-gutter relative w-full pt-4 pb-2">
          <div className="header-row flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href="/" className="logo uppercase">
                Seeens
              </Link>
              <div className="hidden md:block">
                <MainNav />
              </div>
            </div>
            <div className="hidden md:block">
              <Suspense fallback={<span className="caption">Loading…</span>}>
                <Account />
              </Suspense>
            </div>
          </div>
          {/* Its button sits at the right end of the logo row; the panel
              opens over the page below it. */}
          <MobileMenu>
            <MainNav layout="menu" />
            <div className="flex flex-col gap-4 border-t border-line pt-6">
              <Suspense fallback={<span className="caption self-end">Loading…</span>}>
                <Account layout="menu" />
              </Suspense>
            </div>
          </MobileMenu>
        </div>
      </header>
      <main className="page-gutter w-full flex-1 pt-8 pb-16">{children}</main>
      <footer className="rule-top rule-strong bg-surface">
        <p className="page-gutter w-full py-4 text-xs text-muted">
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

async function Account({ layout = "row" }: { layout?: "row" | "menu" }) {
  const user = await getCurrentUser();
  // The header shouldn't take the page down if the workspace can't load;
  // the page's own error state explains what happened.
  const membership = await getMembership().catch(() => null);
  const name = membership?.displayName ?? user.email ?? "you";
  const menu = layout === "menu";

  // Figma App Header: member name, then the workspace chip, then Sign Out.
  return (
    <div className={menu ? "flex flex-col items-end gap-4" : "flex items-center gap-3"}>
      <p className="flex flex-wrap items-center justify-end gap-3 text-sm">
        <span className="text-muted break-all">{name}</span>
        {membership ? <span className="nav-chip nav-chip-inverse">{membership.workspaceName}</span> : null}
      </p>
      <form action="/auth/signout" method="post" className={menu ? "w-full" : undefined}>
        <button type="submit" className={menu ? "nav-chip w-full justify-end" : "nav-chip"}>
          Sign Out
        </button>
      </form>
    </div>
  );
}
