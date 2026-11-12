import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { InlineNav, SideNav } from "@/components/side-nav";
import { MarkSeen } from "@/components/whats-new-seen";
import { formatChangelogDate, getChangelog, type Inline } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "What's New · Seeens",
  description: "What changed in Seeens, newest first.",
};

// What's New (#216): public, so beta testers and anyone they invite can see
// what shipped. Written by hand in content/changelog.md.
export default async function ChangelogPage() {
  const days = await getChangelog();
  const sections = days.map((d) => ({ id: `d-${d.date}`, label: shortDate(d.date) }));
  return (
    <main className="side-nav-layout flex-1 px-4 pt-16 pb-16 [body:has(.app-header)_&]:pt-8">
      <SideNav sections={sections} />
      <MarkSeen />
      <div className="page-measure flex flex-col gap-12">
        <header className="flex flex-col items-start gap-6">
          <Link href="/about" className="logo signed-out-only">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/seeens-logo.svg" alt="Seeens" width={75} height={18} />
          </Link>
          <h1 className="display-l sm:display-xl">What&rsquo;s New</h1>
          <div className="about-prose">
            <p>
              What changed in Seeens, newest first. A lot of it comes from beta feedback, so if something&rsquo;s
              bugging you,{" "}
              <Link href="/feedback" className="link">
                tell us
              </Link>
              .
            </p>
          </div>
        </header>
        <InlineNav sections={sections} />

        {days.length ? (
          days.map((day) => (
            <section key={day.date} aria-labelledby={`d-${day.date}`} className="about-prose">
              <h2 id={`d-${day.date}`} className="display-m">
                <time dateTime={day.date}>{formatChangelogDate(day.date)}</time>
              </h2>
              <ul>
                {day.items.map((item, i) => (
                  <li key={i}>
                    <Line parts={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p>Nothing here yet.</p>
        )}

        <footer className="flex flex-wrap gap-3">
          <Link href="/about" className="button-secondary">
            Read About Seeens
          </Link>
          <Link href="/roadmap" className="button-secondary">
            See the Roadmap
          </Link>
          <Link href="/" className="button-primary">
            Open Seeens
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Line({ parts }: { parts: Inline[] }) {
  return parts.map((p, i) => (
    <Fragment key={i}>
      {p.kind === "bold" ? (
        <strong>{p.text}</strong>
      ) : p.kind === "code" ? (
        <kbd className="keycap">{p.text}</kbd>
      ) : p.kind === "link" ? (
        <Link href={p.href} className="link">
          {p.text}
        </Link>
      ) : (
        p.text
      )}
    </Fragment>
  ));
}

function shortDate(date: string) {
  return formatChangelogDate(date).replace(/,? \d{4}$/, "");
}
