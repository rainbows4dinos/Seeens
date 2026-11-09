import type { Metadata } from "next";
import Link from "next/link";
import { NO_STATUS, STATUS_WORDS } from "@/lib/connections/status-words";
import { FAQ } from "@/lib/help/faq";

export const metadata: Metadata = { title: "Help · Seeens" };

const STATUS_ORDER = ["homies", "lets_play", "prospect", "neutral", "avoid"] as const;
const NO_STATUS_MEANING = "Not sorted yet. Everything starts here until your band picks a status, and you can clear one back to this.";
const STATUS_MEANING: Record<(typeof STATUS_ORDER)[number], string> = {
  homies: "Your people. You look out for each other.",
  lets_play: "You both want to. It just isn't booked yet.",
  prospect: "You'd like to. It isn't mutual yet.",
  neutral: "You know of them. No plans.",
  avoid: "Not for you. Hidden from the directory unless you ask to see them.",
};

// The glossary, each line readable on its own. [word, meaning, where]
const WORDS: [string, string, string][] = [
  ["Listing", "Anyone or anything in the directory: a person, or a band, venue, label, studio, radio station, zine, or collective. Your band's own, or shared by another band.", "My Network, Full Directory"],
  ["From (a band)", "A listing another band added and shared. Its details are theirs to edit; your status and notes on it are yours.", "Top of a listing's page"],
  ["Keep Private", "Hides a listing your band added from every other band. People start private; everything else starts shared.", "Top of a listing's page, or Band Settings > What You Share"],
  ["My Network", "Everything your band has touched: given a status, notes, a plan, or outreach. Plus everything your band added.", "Main nav"],
  ["Full Directory", "Everything every band has shared, yours included.", "Main nav"],
  ["This is us", "Your own band's page. Its members are your lineup, and other bands are measured against it (label mates, shared members).", "Your band in the account menu"],
  ["Played together", "A fact, not a feeling: you've actually done it. The words change by type: played here, booked us, recorded here, been on, covered us.", "A checkbox under status"],
  ["Scene", "A local music community, like Portland DIY. Scenes nest inside bigger ones, and a listing can be in several.", "Scenes"],
  ["Town", "Where they're based, not where you met them.", "Basic Info"],
  ["Members and connections", "How listings link up: who's in a band, who books a venue, who's on a label, who works with whom.", "Members & Connections panel"],
  ["Label mates", "Bands on the same label as yours.", "Your band's page"],
  ["Shares a member with us", "A band with someone who's also in yours.", "Tags on a band's page"],
  ["Outreach", "What happened: a show, an email, a chat at the merch table. Dated, signed, and only its author can change it.", "Activity panel, Log Outreach"],
  ["Next step", "The one thing planned next for a listing, with a date and whose turn it is. Replacing it keeps the old one in history.", "Activity panel"],
  ["Follow-ups", "Every next step your band has planned, by date. Dates are plain facts; nothing turns red.", "Follow-ups"],
  ["Quick view", "The panel that opens beside the directory when you click a card, for quick status changes and notes.", "My Network, Full Directory"],
  ["Archive", "Hides a listing without losing anything. Restore it any time.", "Bottom of a listing's page"],
  ["Merge", "Combines duplicates into one, keeping the best of each. The others stay restorable for 30 days.", "Possible duplicates, or Merge With on a page"],
  ["Photo copier", "Every photo is run through a photocopier effect so the directory looks like one zine.", "Photo on a listing's page"],
  ["Import and export", "Bring in a spreadsheet (CSV), or download everything as one.", "Bottom of the directory"],
  ["Your Page", "Your own person in the directory, linked to your login. Bandmates see that you use Seeens.", "Account menu"],
  ["Band Settings", "Who's in the band, invites, roles, and what you share. Owners rename the band and manage members.", "Account menu"],
  ["Moderator", "A trusted person, picked by an admin, who can fix mistakes in any shared listing. Every fix is logged.", "Shown on listings they've fixed"],
  ["Send Feedback", "Tell the people building Seeens what broke, confused you, or could be better. Private, never public.", "Header"],
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

// Help (#72's companion, copy from the About and Help doc): statuses, the
// glossary, shortcuts, then the FAQ.
export default function HelpPage() {
  return (
    <div className="page-measure flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h1 className="display-l">Help</h1>
        <p className="text-muted">
          The statuses, a glossary of the words Seeens uses, keyboard shortcuts, then common questions. New here? <Link href="/about" className="link">About Seeens</Link>{" "}
          has the big picture. Still stuck? <Link href="/feedback?kind=confusing" className="link">Tell us what confused you</Link>.
        </p>
        <nav aria-label="On this page" className="flex flex-wrap gap-2 pt-2">
          <a href="#statuses" className="button-secondary">
            Statuses
          </a>
          <a href="#words" className="button-secondary">
            Glossary
          </a>
          <a href="#shortcuts" className="button-secondary">
            Shortcuts
          </a>
          <a href="#faq" className="button-secondary">
            FAQ
          </a>
        </nav>
      </div>

      <section aria-labelledby="statuses" className="about-prose">
        <h2 id="statuses" className="display-m">
          Statuses
        </h2>
        <p>
          Every listing can have one status from your band. The five never change, but the words fit what
          you&rsquo;re looking at: you play with a band, book a venue, and collab with a person. Statuses say how you
          feel, not what happened; that&rsquo;s what Played Together is for.
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
  );
}
