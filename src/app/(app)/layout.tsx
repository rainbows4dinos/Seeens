import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Checkmark } from "@carbon/icons-react";
import { getCurrentUser, getMembership, getUsConnection } from "@/lib/auth/dal";
import { initials } from "@/lib/connections/card";
import { photoUrl } from "@/lib/photos/urls";
import { AccountMenu } from "@/components/account-menu";
import { Photo } from "@/components/photo";
import { MainNav } from "@/components/main-nav";
import { MobileMenu } from "@/components/mobile-menu";
import { FeedbackLink } from "@/components/feedback-link";
import { createClient } from "@/lib/supabase/server";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Figma App Header: surface, with an ink rule under it, pinned to the
          top while the page scrolls (#126). */}
      <header className="app-header">
        {/* Desktop: logo, nav chips, and the account on one row. Phones: logo
            and a Menu button; the nav and account move into the menu. */}
        <div className="page-gutter relative w-full py-4">
          <div className="header-row flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href="/" className="logo">
                {/* Figma Logo component: the hand-set wordmark with its cyan misregister and rub-down. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/seeens-logo.svg" alt="Seeens" width={75} height={18} />
              </Link>
              {/* Everyone is a tester for now (#71). */}
              <span className="tag">Beta</span>
              <div className="hidden md:block">
                <MainNav />
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <FeedbackLink className="nav-chip" />
              <Suspense fallback={<span className="caption">Loading…</span>}>
                <Account />
              </Suspense>
            </div>
          </div>
          {/* Its button sits at the right end of the logo row; the panel
              opens over the page below it. */}
          <MobileMenu>
            <MainNav layout="menu" />
            <FeedbackLink className="nav-chip w-full justify-end" />
            <Suspense fallback={<span className="caption self-end">Loading…</span>}>
              <Account layout="menu" />
            </Suspense>
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
  const us = membership ? await getUsConnection() : null;
  const { data: appAdmin } = await (await createClient()).rpc("is_app_admin");
  const name = membership?.displayName ?? user.email ?? "you";

  // Figma account menu (#67): the band, you, then signing out. The band item
  // opens our own page, or offers to add it (#123).
  const groups = (
    <>
      {membership ? (
        <div className="menu-group">
          <p className="caption">Band</p>
          <Link
            href={us ? `/connections/${us.id}` : "/connections/new?us=1"}
            className="nav-chip nav-chip-inverse menu-item"
            aria-label={us ? `${membership.workspaceName}, your band's page` : `${membership.workspaceName}: add your band's page`}
          >
            {membership.workspaceName}
            <Checkmark size={16} aria-hidden="true" />
            <span className="sr-only"> (current band)</span>
          </Link>
          <Link href="/band" className="nav-chip menu-item">
            Band Settings
          </Link>
        </div>
      ) : null}
      <div className="menu-group">
        <p className="caption break-all">Signed in as {name}</p>
        <Link href="/account" className="nav-chip menu-item">
          Account Settings
        </Link>
        {appAdmin ? (
          <Link href="/admin/feedback" className="nav-chip menu-item">
            Feedback Inbox
          </Link>
        ) : null}
      </div>
      <form action="/auth/signout" method="post" className="menu-group">
        <button type="submit" className="nav-chip menu-item">
          Sign Out
        </button>
      </form>
    </>
  );

  if (layout === "menu") return <div className="menu-groups">{groups}</div>;

  const photo = photoUrl(us?.photoPath, 160);
  return (
    <AccountMenu
      band={membership?.workspaceName ?? null}
      member={name}
      picture={
        <span className="account-avatar" aria-hidden="true">
          <span>{initials(name)}</span>
          {photo ? <Photo src={photo} alt="" decoding="async" /> : null}
        </span>
      }
    >
      <div className="menu-groups">{groups}</div>
    </AccountMenu>
  );
}
