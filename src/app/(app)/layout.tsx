import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowsHorizontal, Checkmark } from "@carbon/icons-react";
import { getCurrentUser, getMembership, getMemberships, getUsConnection } from "@/lib/auth/dal";
import { switchBand } from "@/lib/auth/band-switch";
import { initials } from "@/lib/connections/card";
import { photoUrl } from "@/lib/photos/urls";
import { AccountMenu } from "@/components/account-menu";
import { Photo } from "@/components/photo";
import { MainNav } from "@/components/main-nav";
import { MobileMenu } from "@/components/mobile-menu";
import { FeedbackLink } from "@/components/feedback-link";
import { ModeratorWelcome } from "@/components/moderator-welcome";
import { BusyPointer } from "@/components/busy-pointer";
import { createClient } from "@/lib/supabase/server";
import { SignOutForm } from "@/components/sign-out-form";

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
                {/* Everyone is a tester for now (#71). */}
                <span className="logo-beta">Beta</span>
              </Link>
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
      <main className="page-gutter w-full flex-1 pt-8 pb-16">
        <Suspense fallback={null}>
          <NewModeratorNote />
        </Suspense>
        {children}
      </main>
      <BusyPointer />
      <footer className="rule-top rule-strong bg-surface">
        <p className="page-gutter w-full py-4 text-xs text-muted">
          <Link href="/about" className="link">
            About
          </Link>{" "}
          ·{" "}
          <Link href="/help" className="link">
            Help
          </Link>{" "}
          ·{" "}
          <Link href="/ai" className="link">
            Seeens &amp; AI
          </Link>{" "}
          · Town data from{" "}
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

// A note for someone just made a moderator, until they dismiss it.
async function NewModeratorNote() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("moderator_welcome_pending");
  return data ? <ModeratorWelcome /> : null;
}

async function Account({ layout = "row" }: { layout?: "row" | "menu" }) {
  const user = await getCurrentUser();
  // The header shouldn't take the page down if the workspace can't load;
  // the page's own error state explains what happened.
  const membership = await getMembership().catch(() => null);
  const others = membership
    ? (await getMemberships().catch(() => [])).filter((m) => m.workspaceId !== membership.workspaceId)
    : [];
  const us = membership ? await getUsConnection() : null;
  const { data: appAdmin } = await (await createClient()).rpc("is_app_admin");
  const name = membership?.displayName ?? user.email ?? "you";

  // Figma account menu (#67): your bands, you, admin (app admins only), Seeens
  // itself, then signing out. The band item
  // opens our own page, or offers to add it (#123).
  const groups = (
    <>
      {membership ? (
        <div className="menu-group">
          <p className="caption">{others.length ? "Bands" : "Band"}</p>
          {/* A full page load: a link from here to a connection would otherwise open
              the directory's quick view over an empty page. */}
          <a
            href={us ? `/connections/${us.id}` : "/add?us=1"}
            className="nav-chip nav-chip-inverse menu-item"
            aria-label={
              us ? `${membership.workspaceName}, your band's page` : `${membership.workspaceName}: add your band's page`
            }
          >
            {membership.workspaceName}
            <Checkmark size={16} aria-hidden="true" />
            <span className="sr-only"> (current band)</span>
          </a>
          {/* Your other bands (#68): pick one to switch. */}
          {others.map((m) => (
            <form key={m.workspaceId} action={switchBand}>
              <input type="hidden" name="workspace_id" value={m.workspaceId} />
              <button type="submit" className="menu-item menu-switch">
                <span className="sr-only">Switch to </span>
                {m.workspaceName}
                <ArrowsHorizontal size={16} aria-hidden="true" />
              </button>
            </form>
          ))}
          <Link href="/band" className="nav-chip menu-item menu-item-after">
            Band Settings
          </Link>
        </div>
      ) : null}
      <div className="menu-group">
        <p className="caption break-all">You · {name}</p>
        {membership?.connectionId ? (
          <a href={`/connections/${membership.connectionId}`} className="nav-chip menu-item">
            Your Page
          </a>
        ) : null}
        <Link href="/account" className="nav-chip menu-item">
          Account Settings
        </Link>
      </div>
      {/* App admins only: running Seeens itself. */}
      {appAdmin ? (
        <div className="menu-group">
          <p className="caption">Admin</p>
          <Link href="/admin/bands" className="nav-chip menu-item">
            Invite Bands
          </Link>
          <Link href="/admin/moderators" className="nav-chip menu-item">
            Moderators
          </Link>
          <Link href="/admin/feedback" className="nav-chip menu-item">
            Feedback Inbox
          </Link>
          <Link href="/?preview=getting-started" className="nav-chip menu-item">
            Preview Getting Started
          </Link>
        </div>
      ) : null}
      <div className="menu-group">
        <p className="caption">Seeens</p>
        <Link href="/help" className="nav-chip menu-item">
          Help
        </Link>
        <Link href="/about" className="nav-chip menu-item">
          About Seeens
        </Link>
      </div>
      <SignOutForm className="menu-group" buttonClassName="nav-chip menu-item" />
    </>
  );

  if (layout === "menu") return <div className="menu-groups">{groups}</div>;

  const photo = photoUrl(us?.photoPath, 160);
  return (
    <AccountMenu
      band={membership?.workspaceName ?? null}
      // First name only, to keep the header short; the menu has the full name.
      member={name.trim().split(/\s+/)[0] || name}
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
