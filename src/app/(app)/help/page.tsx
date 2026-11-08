import type { Metadata } from "next";
import Link from "next/link";
import { NO_STATUS, STATUS_WORDS } from "@/lib/connections/status-words";

export const metadata: Metadata = { title: "Help · Seeens" };

const STATUS_ORDER = ["homies", "lets_play", "prospect", "neutral", "avoid"] as const;
const STATUS_MEANING: Record<(typeof STATUS_ORDER)[number], string> = {
  homies: "Your people. You look out for each other.",
  lets_play: "You both want to. It just isn't booked yet.",
  prospect: "You'd like to. It isn't mutual yet.",
  neutral: "You know of them. No plans.",
  avoid: "Not for you. Hidden from the directory unless you ask to see them.",
};

// The rest of the words, each line readable on its own. [word, meaning, where]
const WORDS: [string, string, string][] = [
  ["Connection", "Anyone in the directory: a person, or a band, venue, label, studio, radio station, zine, or collective. Your band's own, or shared by another band.", "My Network, Full Directory"],
  ["From (a band)", "A record another band added and shared. Its details are theirs to edit; your status and notes on it are yours.", "Top of a record's page"],
  ["Keep Private", "Hides a record your band added from every other band. People start private; everything else starts shared.", "Top of a record's page, or Band Settings > What You Share"],
  ["My Network", "Everything your band has touched: given a status, notes, a plan, or outreach. Plus everything your band added.", "Main nav"],
  ["Full Directory", "Everything every band has shared, yours included.", "Main nav"],
  ["This is us", "Your own band's page. Its members are your lineup, and other bands are measured against it (label mates, shared members).", "Your band in the account menu"],
  ["Played together", "A fact, not a feeling: you've actually done it. The words change by type: played here, booked us, recorded here, been on, covered us.", "A checkbox under status"],
  ["Scene", "A local music community, like Portland DIY. Scenes nest inside bigger ones, and a connection can be in several.", "Scenes"],
  ["Town", "Where they're based, not where you met them.", "Basic Info"],
  ["Members and connections", "How connections link up: who's in a band, who books a venue, who's on a label, who works with whom.", "Members & Connections panel"],
  ["Label mates", "Bands on the same label as yours.", "Your band's page"],
  ["Shares a member with us", "A band with someone who's also in yours.", "Tags on a band's page"],
  ["Outreach", "What happened: a show, an email, a chat at the merch table. Dated, signed, and only its author can change it.", "Activity panel, Log Outreach"],
  ["Next step", "The one thing planned next for a connection, with a date and whose turn it is. Replacing it keeps the old one in history.", "Activity panel"],
  ["Follow-ups", "Every next step your band has planned, by date. Dates are plain facts; nothing turns red.", "Follow-ups"],
  ["Quick view", "The panel that opens beside the directory when you click a card, for quick status changes and notes.", "My Network, Full Directory"],
  ["Archive", "Hides a connection without losing anything. Restore it any time.", "Bottom of a connection's page"],
  ["Merge", "Combines duplicates into one, keeping the best of each. The others stay restorable for 30 days.", "Possible duplicates, or Merge With on a page"],
  ["Photo copier", "Every photo is run through a photocopier effect so the directory looks like one zine.", "Photo on a connection's page"],
  ["Import and export", "Bring in a spreadsheet (CSV), or download everything as one.", "Bottom of the directory"],
  ["Your Page", "Your own person in the directory, linked to your login. Bandmates see that you use Seeens.", "Account menu"],
  ["Band Settings", "Who's in the band, invites, roles, and what you share. Owners rename the band and manage members.", "Account menu"],
  ["Moderator", "A trusted person, picked by an admin, who can fix mistakes in any shared record. Every fix is logged.", "Shown on records they've fixed"],
  ["Send Feedback", "Tell the people building Seeens what broke, confused you, or could be better. Private, never public.", "Header"],
];

// [question, answer]. A first guess at what testers ask; real Confusing
// feedback replaces these as it comes in.
const FAQ: [string, string][] = [
  ["Who can see what I add?", "A record you add (its name, type, town, links, photo) is seen by every band on Seeens, unless you set it to Keep Private. Your status, notes, contacts, and plans are only seen by your band."],
  ["Can another band change something we added?", "No. Only the band that added a record can change it, plus moderators fixing mistakes. Other bands can keep their own notes on it, which you never see."],
  ["A record says “From” another band. Can I use it?", "Yes. Set a status, add notes, plan a next step, or archive it, just like your own. Its name and details stay the other band's to edit."],
  ["What's the difference between Homies and Let's Play?", "Homies are your people already. Let's Play means you both want to play together and haven't booked it yet. The table above has all five."],
  ["We've played with them. Why isn't that a status?", "Status is how you feel; Played Together is what happened. You can have played with a band and still mark them Avoid."],
  ["I added someone twice.", "Open one of them and use Merge With, or follow “possible duplicates” in the directory. You pick what to keep, and you can undo for 30 days."],
  ["Can I delete a connection?", "Archive it instead, at the bottom of its page. It leaves the directory but keeps its history, and you can restore it."],
  ["Why can't I edit my bandmate's outreach?", "Outreach is a record of what someone did, so only the person who logged it can change it. Add your own entry instead."],
  ["How do I add my bandmates?", "Band Settings, then Invite a Bandmate. Send it by email or copy a link to text them. Links work once, for 7 days."],
  ["I'm in two bands. How do I switch?", "Not yet. Seeens shows the first band you joined for now; switching between bands is planned."],
  ["Does Seeens find venues or contacts for me?", "Other bands do. Everything in Seeens was added by a band that knows it firsthand. Nothing is scraped or guessed."],
  ["Does Seeens use AI?", "Not in the app. Nothing in Seeens writes, makes, or guesses anything: every record was added by a band that knows it firsthand. Larry builds Seeens with an AI coding helper, since it's one person working nights and weekends. If an AI feature is ever added, it'll be off unless your band turns it on, and it will never make art or speak for you."],
  ["Can I get my data out?", "Yes. Export your band's records and notes as a CSV from the bottom of the directory, any time."],
  ["Is there an app?", "Seeens works in your phone's browser, laid out for the merch table. There's nothing to install."],
  ["Does it cost anything?", "No, not during the beta. If that ever changes, you'll hear before anything is charged, and you can always export your band's records."],
  ["I forgot my password.", "On Sign In, choose Forgot your password. The link works for an hour."],
];

// Help (#72's companion, copy from the About and Help doc): the words first,
// since most confusion is vocabulary, then the FAQ.
export default function HelpPage() {
  return (
    <div className="page-measure flex flex-col gap-12">
      <div className="flex flex-col gap-2">
        <h1 className="display-l">Help</h1>
        <p className="text-muted">
          The words Seeens uses, then common questions. New here? <Link href="/about" className="link">About Seeens</Link>{" "}
          has the big picture. Still stuck? <Link href="/feedback?kind=confusing" className="link">Tell us what confused you</Link>.
        </p>
      </div>

      <section aria-labelledby="statuses" className="about-prose">
        <h2 id="statuses" className="display-m">
          How you feel about them
        </h2>
        <p>
          Every connection can have one status from your band. The five never change, but the words fit what
          you&rsquo;re looking at: you play with a band, book a venue, and collab with a person. Statuses say how you
          feel, not what happened; that&rsquo;s what Played Together is for. Anything you haven&rsquo;t sorted shows{" "}
          {NO_STATUS}.
        </p>
        <div className="overflow-x-auto">
          <table className="about-table">
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
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="words" className="about-prose">
        <h2 id="words" className="display-m">
          The rest of the words
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

      <section aria-labelledby="faq" className="about-prose">
        <h2 id="faq" className="display-m">
          Questions
        </h2>
        <div className="help-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
