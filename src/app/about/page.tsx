import type { Metadata } from "next";
import Link from "next/link";
import { InlineNav, SideNav, type SideNavSection } from "@/components/side-nav";
import { NO_STATUS, STATUS_HINT_WORDS, STATUS_WORDS } from "@/lib/connections/status-words";
import { ABOUT_FAQ } from "@/lib/help/faq";

export const metadata: Metadata = {
  title: "About · Seeens",
  description: "A directory of independent music that every band on it builds together.",
};

// A screenshot for "How it works", framed in a window. Real data, shared parts
// only (no statuses, notes, or contacts). Leave null until there is one.
const SCREENSHOT: { src: string; alt: string } | null = null;

const STATUS_ORDER = ["homies", "lets_play", "prospect", "neutral", "avoid"] as const;
const NO_STATUS_MEANING =
  "Not sorted yet. Everything starts here, and most of the shared directory will stay here, which is fine.";
const STATUS_MEANING: Record<(typeof STATUS_ORDER)[number], string> = {
  homies: "Your people. You look out for each other.",
  lets_play: "You both want to play together; it just isn't booked.",
  prospect: "You'd like to. They don't know yet, or it isn't mutual.",
  neutral: STATUS_HINT_WORDS.band.neutral.replace("We know", "You know"),
  avoid: "Not for you. Hidden from your directory unless you ask to see them.",
};

// The page's sections, for the side nav.
const SECTIONS: SideNavSection[] = [
  { id: "how", label: "How It Works" },
  { id: "feel", label: "Statuses" },
  { id: "do", label: "Features" },
  { id: "shared", label: "Sharing and Privacy" },
  { id: "tidy", label: "Moderation" },
  { id: "faq", label: "FAQ" },
  { id: "who", label: "Who Made It" },
  { id: "beta", label: "Closed Beta" },
];

// About (#72's companion, copy from the About and Help doc): public, for
// people who just got an invite. Three ideas: one shared directory, your
// band's own layer on it, and Keep Private.
export default function AboutPage() {
  return (
    <main className="side-nav-layout flex-1 px-4 py-16">
      <SideNav sections={SECTIONS} />
      <div className="page-measure flex flex-col gap-12">
        <header className="flex flex-col items-start gap-6">
          <Link href="/" className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/seeens-logo.svg" alt="Seeens" width={75} height={18} />
          </Link>
          <h1 className="font-display text-5xl leading-[44px] font-bold tracking-[-0.045em] sm:display-xxl">
            Your people.
            <br />
            <span className="swipe">Your scenes.</span>
          </h1>
          <div className="about-prose">
            <p>
              Seeens is a directory of independent music that every band on it builds together: the bands you&rsquo;ve
              played with, the venues that book you, the promoters, labels, zines, and radio shows, and the towns and
              scenes they belong to.
            </p>
            <p>
              On top of it, your band keeps its own notes. That&rsquo;s the stuff that usually lives in group texts and
              one bandmate&rsquo;s head. Who booked that show in Spokane? Which bands want to play with us again? Who
              said they&rsquo;d follow up, and did they?
            </p>
          </div>
          <Link href="/login" className="button-primary">
            Sign In
          </Link>
        </header>
        <InlineNav sections={SECTIONS} />

        <section aria-labelledby="how" className="about-prose">
          <h2 id="how" className="display-m">
            How It Works
          </h2>
          <ol>
            <li>
              <strong>One directory, shared by every band.</strong> Anyone in a band can add a venue, band, or person.
              Add something and every band on Seeens can see it, so nobody types in the same venue twice.
            </li>
            <li>
              <strong>Your band&rsquo;s notes are your band&rsquo;s.</strong> What you think of someone, what
              you&rsquo;ve played, your notes, contacts, and plans are only ever seen by your bandmates.
            </li>
            <li>
              <strong>Keep Private hides a listing from other bands.</strong> People start private; venues, bands, and
              labels start shared. Flip any of them in Band Settings.
            </li>
          </ol>
          {SCREENSHOT ? (
            <figure className="window">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SCREENSHOT.src} alt={SCREENSHOT.alt} className="block w-full" />
            </figure>
          ) : null}
        </section>

        <section aria-labelledby="feel" className="about-prose">
          <h2 id="feel" className="display-m">
            Statuses
          </h2>
          <p>
            Every listing can get one status from your band. It&rsquo;s how you feel, not what&rsquo;s happened, and
            nobody outside your band sees it.
          </p>
          <div className="overflow-x-auto">
            <table className="about-table status-table">
              <thead>
                <tr>
                  <th scope="col">Bands</th>
                  <th scope="col">Venues</th>
                  <th scope="col">People</th>
                  <th scope="col">What it means</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_ORDER.map((s) => (
                  <tr key={s}>
                    <th scope="row">{STATUS_WORDS.band[s]}</th>
                    <td>{STATUS_WORDS.venue[s]}</td>
                    <td>{STATUS_WORDS.people[s]}</td>
                    <td>{STATUS_MEANING[s]}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row">{NO_STATUS}</th>
                  <td>{NO_STATUS}</td>
                  <td>{NO_STATUS}</td>
                  <td>{NO_STATUS_MEANING}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="do" className="about-prose">
          <h2 id="do" className="display-m">
            Features
          </h2>
          <ul>
            <li>Find the venues, bands, and people other bands already know, and add the ones you know.</li>
            <li>Mark how you feel about each: Homies, Let&rsquo;s Play, Want to Play, Heard Of, or Avoid.</li>
            <li>Group them by scene and town, so planning a run starts with who you already know there.</li>
            <li>Log what happened and plan what&rsquo;s next, with a date and whose turn it is.</li>
            <li>Import the spreadsheet you&rsquo;ve been keeping, and export it all as a CSV whenever you want.</li>
          </ul>
        </section>

        <section aria-labelledby="shared" className="about-prose">
          <h2 id="shared" className="display-m">
            Sharing and Privacy
          </h2>
          <div className="overflow-x-auto">
            <table className="about-table">
              <thead>
                <tr>
                  <th scope="col">Every band sees</th>
                  <th scope="col">Only your band sees</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Name, type, town, links, photo</td>
                  <td>Your status (Homies, Avoid, and the rest)</td>
                </tr>
                <tr>
                  <td>Venue details: type of space, capacity, ages, how to book</td>
                  <td>Notes, email, and phone numbers you added</td>
                </tr>
                <tr>
                  <td>Who added it</td>
                  <td>Played together, plans, outreach, archive</td>
                </tr>
                <tr>
                  <td />
                  <td>Anything you set to Keep Private</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Only people in a band can see Seeens, apart from a few shared bands and venues with photos that drift past
            on the sign-in page (name, town, scenes, and photo). Keep Private takes a listing off it. The band that
            added a listing is the one that can change it. Nothing is sold or used for ads. You can export your
            band&rsquo;s listings, and you can delete your account from Account Settings.
          </p>
        </section>

        <section aria-labelledby="tidy" className="about-prose">
          <h2 id="tidy" className="display-m">
            Moderation
          </h2>
          <p>
            Any band can add to Seeens, and the band that added a listing looks after it. Moderators, trusted people
            from the scene, can fix mistakes in any shared listing. Every fix is logged.
          </p>
        </section>

        <section aria-labelledby="faq" className="about-prose">
          <h2 id="faq" className="display-m">
            FAQ
          </h2>
          <div className="help-faq">
            {ABOUT_FAQ.map(([q, a, link]) => (
              <details key={q} open>
                <summary>{q}</summary>
                <p>
                  {a}
                  {link ? (
                    <>
                      {" "}
                      <Link href={link.href} className="link">
                        {link.label}
                      </Link>
                      .
                    </>
                  ) : null}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="who" className="about-prose">
          <h2 id="who" className="display-m">
            Who Made It
          </h2>
          <p>
            Seeens was created by Larry Reynolds, a designer and developer who plays in Merwulf, a post-punk trio in
            Portland, Oregon. It started as Merwulf&rsquo;s own list and grew from there.
          </p>
        </section>

        <section aria-labelledby="beta" className="about-prose">
          <h2 id="beta" className="display-m">
            Closed Beta
          </h2>
          <p>
            Seeens is in a closed beta. Everyone using it is a tester, so things will change, and what you tell us
            decides what changes. Once you&rsquo;re in, Send Feedback is in the header.
          </p>
        </section>

        <footer className="flex flex-wrap gap-3">
          <Link href="/login" className="button-primary">
            Sign In
          </Link>
          <Link href="/ai" className="button-secondary">
            Seeens &amp; AI
          </Link>
        </footer>
      </div>
    </main>
  );
}
