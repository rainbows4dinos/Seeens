import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { InlineNav, SideNav } from "@/components/side-nav";
import type { Inline } from "@/lib/changelog";
import { getRoadmap } from "@/lib/roadmap";

export const metadata: Metadata = {
  title: "Roadmap · Seeens",
  description: "What's coming to Seeens: now, next, and later.",
};

const ISSUES = "https://github.com/rainbows4dinos/Seeens/issues/";
const INTRO: Record<string, string> = {
  Now: "Being built.",
  Next: "Up after that.",
  Later: "Planned, not started.",
};

// Roadmap (#217): public, so testers can see where Seeens is headed without
// asking. No dates, in line with the no-pressure rule. Kept by hand in
// content/roadmap.md. Feedback stays private: no voting or comments here.
export default async function RoadmapPage() {
  const sections = (await getRoadmap()).filter((s) => s.items.length);
  const nav = sections.map((s) => ({ id: s.label.toLowerCase(), label: s.label }));
  return (
    <main className="side-nav-layout flex-1 px-4 pt-16 pb-16 [body:has(.app-header)_&]:pt-8">
      <SideNav sections={nav} />
      <div className="page-measure flex flex-col gap-12">
        <header className="flex flex-col items-start gap-6">
          <Link href="/about" className="logo signed-out-only">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/seeens-logo.svg" alt="Seeens" width={75} height={18} />
          </Link>
          <h1 className="display-l sm:display-xl">Roadmap</h1>
          <div className="about-prose">
            <p>
              Where Seeens is headed. There are no dates: it&rsquo;s built by one person, and beta feedback can move
              things around. What already shipped is on{" "}
              <Link href="/changelog" className="link">
                What&rsquo;s New
              </Link>
              .
            </p>
          </div>
        </header>
        <InlineNav sections={nav} />

        {sections.map((section) => (
          <section key={section.label} aria-labelledby={section.label.toLowerCase()} className="about-prose">
            <h2 id={section.label.toLowerCase()} className="display-m">
              {section.label}
            </h2>
            <p className="text-muted">{INTRO[section.label]}</p>
            <ul>
              {section.items.map((item, i) => (
                <li key={i}>
                  <Line parts={item.parts} />
                  {item.issue ? (
                    <>
                      {" "}
                      <a
                        href={`${ISSUES}${item.issue}`}
                        className="link text-sm text-muted"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        #{item.issue}
                        <span className="sr-only"> on GitHub (opens in a new tab)</span>
                      </a>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section aria-labelledby="ideas" className="about-prose">
          <h2 id="ideas" className="display-m">
            Got an Idea?
          </h2>
          <p>
            Tell us with{" "}
            <Link href="/feedback" className="link">
              Send Feedback
            </Link>{" "}
            once you&rsquo;re signed in. It comes straight to Larry, and it&rsquo;s how most of this list got here.
          </p>
        </section>

        <footer className="flex flex-wrap gap-3">
          <Link href="/about" className="button-secondary">
            About Seeens
          </Link>
          <Link href="/changelog" className="button-secondary">
            What&rsquo;s New
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
