import type { Metadata } from "next";
import Link from "next/link";
import { InlineNav, SideNav, type SideNavSection } from "@/components/side-nav";
import { NO_STATUS, STATUS_WORDS } from "@/lib/connections/status-words";
import { FAQ } from "@/lib/help/faq";

export const metadata: Metadata = { title: "Help · Seeens" };

const STATUS_ORDER = ["homies", "lets_play", "prospect", "neutral", "avoid"] as const;
const NO_STATUS_MEANING =
  "Not sorted yet. Everything starts here until your band picks a status, and you can clear one back to this.";
const STATUS_MEANING: Record<(typeof STATUS_ORDER)[number], string> = {
  homies: "Your people. You look out for each other.",
  lets_play: "You both want to. It just isn't booked yet.",
  prospect: "You'd like to. It isn't mutual yet.",
  neutral: "You know of them. No plans.",
  avoid: "Not for you. They sit at the very end of the directory, and never on your Home.",
};

// The glossary, each line readable on its own. [word, meaning, where]
const WORDS: [string, string, string][] = [
  [
    "Listing",
    "Anyone or anything in the directory: a person, or a band, venue, label, studio, radio station, zine, or collective. Your band's own, or shared by another band.",
    "Directory",
  ],
  [
    "From (a band)",
    "A listing another band added and shared. Its details are theirs to edit; your status and notes on it are yours.",
    "Top of a listing's page",
  ],
  [
    "Keep Private",
    "Hides a listing your band added from every other band. People start private; everything else starts shared.",
    "Top of a listing's page, or Band Settings > What You Share",
  ],
  [
    "Home",
    "Your band's own page: what's up next, your Homies and Let's play, and what other bands added near you.",
    "Main nav",
  ],
  [
    "Directory",
    "Everything every band has shared, yours included, with Avoid at the end. Where you find who you don't know yet.",
    "Main nav",
  ],
  [
    "This is us",
    "Your own band's page. Its members are your lineup, and other bands are measured against it (label mates, shared members).",
    "Your band in the account menu",
  ],
  [
    "Played together",
    "A fact, not a feeling: you've actually done it. The words change by type: played here, booked us, recorded here, been on, covered us.",
    "A checkbox under status",
  ],
  [
    "Scene",
    "A local music community, like Portland DIY. Scenes nest inside bigger ones, and a listing can be in several.",
    "Scenes",
  ],
  ["Town", "Where they're based, not where you met them.", "Basic Info"],
  [
    "Type of Space",
    "What kind of room a venue is: a dive bar, house shows, a record store. Pick any that apply. DIY or licensed follows from the type; art spaces, community spaces, and parks get a DIY checkbox.",
    "Venue Details, and the Space filter on Venues",
  ],
  [
    "Members and connections",
    "How listings link up: who's in a band, who books a venue, who's on a label, who works with whom.",
    "Members & Connections panel",
  ],
  ["Label mates", "Bands on the same label as yours.", "Your band's page"],
  ["Shares a member with us", "A band with someone who's also in yours.", "Tags on a band's page"],
  [
    "Outreach",
    "What happened: a show, an email, a chat at the merch table. Dated, signed, and only its author can change it.",
    "Activity panel, Log Outreach",
  ],
  [
    "Next step",
    "The one thing planned next for a listing, with a date and whose turn it is. Replacing it keeps the old one in history.",
    "Activity panel",
  ],
  [
    "Follow-ups",
    "Every next step your band has planned, by date. Dates are plain facts; nothing turns red.",
    "Up Next on Home, and All follow-ups",
  ],
  [
    "Quick view",
    "The panel that opens beside the directory when you click a card, for quick status changes and notes.",
    "Directory",
  ],
  ["Archive", "Hides a listing without losing anything. Restore it any time.", "Bottom of a listing's page"],
  [
    "Merge",
    "Combines duplicates into one, keeping the best of each. The others stay restorable for 30 days.",
    "Possible duplicates, or Merge With on a page",
  ],
  [
    "Photo copier",
    "Every photo is run through a photocopier effect so the directory looks like one zine.",
    "Photo on a listing's page",
  ],
  ["Import and export", "Bring in a spreadsheet (CSV), or download everything as one.", "Bottom of the directory"],
  [
    "Your Page",
    "Your own person in the directory, linked to your login. Bandmates see that you use Seeens.",
    "Account menu",
  ],
  [
    "Band Settings",
    "Who's in the band, invites, roles, and what you share. Owners rename the band and manage members.",
    "Account menu",
  ],
  [
    "Moderator",
    "A trusted person, picked by an admin, who can fix mistakes in any shared listing. Every fix is logged.",
    "Shown on listings they've fixed",
  ],
  [
    "Send Feedback",
    "Tell the people building Seeens what broke, confused you, or could be better. Private, never public.",
    "Header",
  ],
];

// The page's sections, for the side nav.
const SECTIONS: SideNavSection[] = [
  { id: "statuses", label: "Statuses" },
  { id: "words", label: "Glossary" },
  { id: "shortcuts", label: "Keyboard Shortcuts" },
  { id: "faq", label: "FAQ" },
];

// In the quick view (#244).
const SHORTCUTS: [string, string][] = [
  ["J", "Next listing"],
  ["K", "Previous listing"],
  ["1", `Status: ${STATUS_WORDS.band.homies}`],
  ["2", `Status: ${STATUS_WORDS.band.lets_play}`],
  ["3", `Status: ${STATUS_WORDS.band.prospect}`],
  ["4", `Status: ${STATUS_WORDS.band.neutral}`],
  ["5", `Status: ${STATUS_WORDS.band.avoid}`],
  ["6", `Status: ${NO_STATUS}`],
  ["Esc", "Close the quick view"],
];

// Selecting several listings in the directory (#243).
const SELECT_SHORTCUTS: [string, string][] = [
  ["Cmd-click", "Select a listing, or deselect it (Ctrl-click on Windows)"],
  ["Shift-click", "Select everything from the last one you picked"],
  ["1–6", "In the Set Status menu, pick a status"],
  ["Esc", "Clear the selection"],
];

// Help (#72's companion, copy from the About and Help doc): statuses, the
// glossary, shortcuts, then the FAQ.
export default function HelpPage() {
  return (
    <div className="side-nav-layout in-app">
      <SideNav sections={SECTIONS} />
      <div className="page-measure flex flex-col gap-12">
        <div className="flex flex-col gap-2">
          <h1 className="display-l">Help</h1>
          <p className="text-muted">
            The statuses, a glossary of the words Seeens uses, keyboard shortcuts, then common questions. New here?{" "}
            <Link href="/about" className="link">
              About Seeens
            </Link>{" "}
            has the big picture. Still stuck?{" "}
            <Link href="/feedback?kind=confusing" className="link">
              Tell us what confused you
            </Link>
            .
          </p>
          <InlineNav sections={SECTIONS} />
        </div>

        <section aria-labelledby="statuses" className="about-prose">
          <h2 id="statuses" className="display-m">
            Statuses
          </h2>
          <p>
            Every listing can have one status from your band. The five never change, but the words fit what you&rsquo;re
            looking at: you play with a band, book a venue, and collab with a person. Statuses say how you feel, not
            what happened; that&rsquo;s what Played Together is for.
          </p>
          <div className="overflow-x-auto">
            <table className="about-table status-table">
              <thead>
                <tr>
                  <th scope="col">Bands</th>
                  <th scope="col">Venues and promoters</th>
                  <th scope="col">People and orgs</th>
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

        <section aria-labelledby="words" className="about-prose">
          <h2 id="words" className="display-m">
            Glossary
          </h2>
          <dl className="help-words">
            {WORDS.map(([word, meaning, where]) => (
              <div key={word}>
                <dt>{word}</dt>
                <dd>
                  {meaning} <span className="caption">{where}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="shortcuts" className="about-prose">
          <h2 id="shortcuts" className="display-m">
            Keyboard Shortcuts
          </h2>
          <p>
            For sorting a lot of listings at once. They work while the quick view is open, except when you&rsquo;re
            typing in a field.
          </p>
          <table className="about-table">
            <thead>
              <tr>
                <th scope="col" className="w-24">
                  Key
                </th>
                <th scope="col">What it does</th>
              </tr>
            </thead>
            <tbody>
              {SHORTCUTS.map(([key, what]) => (
                <tr key={what}>
                  <th scope="row">
                    <kbd className="keycap">{key}</kbd>
                  </th>
                  <td>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="display-s">Setting Several at Once</h3>
          <p>
            In the Directory, click a listing&rsquo;s photo to select it. A bar shows up at the bottom to set a status
            or mark them played together for all of them, with an Undo. On a phone, press and hold a listing to start,
            then tap to add more.
          </p>
          <table className="about-table">
            <thead>
              <tr>
                <th scope="col" className="w-32">
                  Key
                </th>
                <th scope="col">What it does</th>
              </tr>
            </thead>
            <tbody>
              {SELECT_SHORTCUTS.map(([key, what]) => (
                <tr key={what}>
                  <th scope="row">
                    <kbd className="keycap">{key}</kbd>
                  </th>
                  <td>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="faq" className="about-prose">
          <h2 id="faq" className="display-m">
            FAQ
          </h2>
          <div className="help-faq">
            {FAQ.map(([q, a, link]) => (
              <details key={q}>
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
      </div>
    </div>
  );
}
