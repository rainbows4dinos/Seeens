// The FAQ (copy from the About and Help doc). Help shows all of it; About
// shows the questions people ask before joining, so the answers can't drift.

// [question, answer]. A first guess at what testers ask; real Confusing
// feedback replaces these as it comes in.
export type FaqLink = { href: string; label: string };

export const FAQ: [string, string, FaqLink?][] = [
  ["How do I join Seeens?", "Someone already on Seeens invites you. For now, ask a band that uses it. There's no sign-up form, and the plan is to keep it that way after the beta: everyone comes in through someone in the scene who knows them. That makes it a lot harder for fake bands, scammers, and abusers to get in."],
  ["Who can see what I add?", "Bands, venues, labels, and the rest are seen by every band on Seeens (their name, type, town, links, and photo), unless you set them to Keep Private. People start private: only your band sees a person you add, until you share them. Your status, notes, contacts, and plans are only ever seen by your band."],
  ["Can another band change something we added?", "No. Only the band that added a listing can change it, plus moderators fixing mistakes. Other bands can keep their own notes on it, which you never see."],
  ["A listing says “From” another band. Can I use it?", "Yes. Set a status, add notes, plan a next step, or archive it, just like your own. Its name and details stay the other band's to edit."],
  ["What's the difference between Homies and Let's Play?", "Homies are your people already. Let's Play means you both want to play together and haven't booked it yet. The table above has all five."],
  ["We've played with them. Why isn't that a status?", "Status is how you feel; Played Together is what happened. You can have played with a band and still mark them Avoid."],
  ["I added someone twice.", "Open one of them and use Merge With, or follow “possible duplicates” in the directory. You pick what to keep, and you can undo for 30 days."],
  ["Are there keyboard shortcuts?", "Yes, in the quick view: J and K step through listings, 1 to 6 set the status, and Esc closes it.", { href: "/help#shortcuts", label: "All the shortcuts" }],
  ["Can I delete a listing?", "Archive it instead, at the bottom of its page. It leaves the directory but keeps its history, and you can restore it."],
  ["Why can't I edit my bandmate's outreach?", "Outreach is a record of what someone did, so only the person who logged it can change it. Add your own entry instead."],
  ["How do I add my bandmates?", "Band Settings, then Invite a Bandmate. Send it by email or copy a link to text them. Links work once, for 7 days."],
  ["I'm in two bands. How do I switch?", "Open the account menu at the top. Your other bands are listed under Bands; pick one to switch."],
  ["Does Seeens find venues or contacts for me?", "Other bands do. Everything in Seeens was added by a band that knows it firsthand. Nothing is scraped or guessed."],
  ["Does Seeens use AI?", "Not in the app. Nothing in Seeens writes, makes, or guesses anything: every listing was added by a band that knows it firsthand. Larry builds Seeens with an AI coding helper, since it's one person working nights and weekends. If an AI feature is ever added, it'll be off unless your band turns it on, and it will never make art or speak for you.", { href: "/ai", label: "Read the full commitments" }],
  ["Can I get my data out?", "Yes. Export your band's listings and notes as a CSV from the bottom of the directory, any time."],
  ["Is there an app?", "Seeens works in your phone's browser, laid out for the merch table. There's nothing to install."],
  ["Does it cost anything?", "No. Seeens is Larry's gift to the scene, not a business. Running it does cost a little (hosting and the like), so the plan is to let bands chip in with donations someday, if they want to. No ads, no paid tiers, no venture capital, and Seeens will never be sold to a bigger company. You can always export your band's listings."],
  ["I forgot my password.", "On Sign In, choose Forgot your password. The link works for an hour."],
];

/** On About, public: the questions someone asks before they join. */
export const ABOUT_QUESTIONS = [
  "How do I join Seeens?",
  "Does Seeens use AI?",
  "Does it cost anything?",
  "Who can see what I add?",
  "Can I get my data out?",
];

export const ABOUT_FAQ = ABOUT_QUESTIONS.map((q) => {
  const hit = FAQ.find(([question]) => question === q);
  if (!hit) throw new Error(`FAQ question missing: ${q}`);
  return hit;
});
