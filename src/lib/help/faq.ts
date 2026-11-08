// The FAQ (copy from the About and Help doc). Help shows all of it; About
// shows the questions people ask before joining, so the answers can't drift.

// [question, answer]. A first guess at what testers ask; real Confusing
// feedback replaces these as it comes in.
export const FAQ: [string, string][] = [
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

/** On About, public: the questions someone asks before they join. */
export const ABOUT_QUESTIONS = [
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
