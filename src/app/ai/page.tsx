import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Where Seeens Stands on AI · Seeens",
  description: "There's no AI in Seeens. If that ever changes, these are the rules.",
};

// The public AI commitments, trimmed from the AI Constitution draft (copy in
// the About and Help doc). Linked from About and the FAQ's AI answer.
const RULES: [string, string][] = [
  ["Seeens never makes art.", "No generated images, music, flyers, bios, or posts. Ever."],
  ["Seeens never speaks for you.", "It doesn't write your messages, and it doesn't send or post anything on your behalf."],
  ["It's off unless your band turns it on.", "Any AI feature is off by default for every band. A band that never wants AI never runs into it."],
  ["You decide what's true.", "Anything AI finds is a suggestion. Nothing is saved until someone in your band accepts it."],
  ["It shows its work.", "Every suggestion comes with its source and that source's date, so you can check it yourself."],
  ["Your stuff is never training data.", "Your listings, notes, and uploads aren't used to train any model, ours or anyone else's. Seeens only uses providers that commit to that in writing, and never sells data."],
  ["Plain tools first.", "Where something simpler works, Seeens uses it instead. AI runs only when someone in a band asks for it, never in the background or in bulk."],
  ["It says what runs where.", "This page will name every AI provider Seeens uses, what's sent to it, and how long it's kept."],
  ["It's never metered to you.", "No tokens, credits, or AI upsells."],
  ["Changes happen in the open.", "If any of this changes, you'll hear ahead of time, and your band can switch AI off before the change takes effect."],
];

export default function AiPage() {
  return (
    <main className="page-measure flex flex-1 flex-col gap-12 px-4 py-16">
      <header className="flex flex-col items-start gap-6">
        <Link href="/about" className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/seeens-logo.svg" alt="Seeens" width={75} height={18} />
        </Link>
        <h1 className="display-l sm:display-xl">Where Seeens Stands on AI</h1>
        <div className="about-prose">
          <p>
            A lot of the DIY scene wants nothing to do with AI, and for good reasons: slop, art taken without consent,
            companies run by a few rich people, and data centers eating power and water. Seeens agrees with every one
            of those. Seeens also believes that there are ethical, and even revolutionary, ways to use AI.
          </p>
        </div>
      </header>

      <section aria-labelledby="today" className="about-prose">
        <h2 id="today" className="display-m">
          Today
        </h2>
        <p>
          There&rsquo;s no AI in Seeens. Nothing in the app writes, makes, or guesses anything, and nothing you put in
          it is sent to an AI service. Larry builds Seeens with an AI coding helper, since it&rsquo;s one person working
          nights and weekends.
        </p>
      </section>

      <section aria-labelledby="rules" className="about-prose">
        <h2 id="rules" className="display-m">
          If that ever changes
        </h2>
        <p>These are the rules. If Seeens breaks any of them, call it out.</p>
        <ol>
          {RULES.map(([rule, detail]) => (
            <li key={rule}>
              <strong>{rule}</strong> {detail}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="where" className="about-prose">
        <h2 id="where" className="display-m">
          What runs where
        </h2>
        <p>
          Nothing, yet. Before any AI feature ships, this section will name each provider, what&rsquo;s sent to it, how
          long it&rsquo;s kept, and link to its no-training terms.
        </p>
      </section>

      <footer className="flex flex-wrap gap-3">
        <Link href="/about" className="button-secondary">
          About Seeens
        </Link>
        <Link href="/login" className="button-primary">
          Sign In
        </Link>
      </footer>
    </main>
  );
}
