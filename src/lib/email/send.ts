import "server-only";

// Email from Seeens (#68): Resend, when RESEND_API_KEY and EMAIL_FROM are
// set (for example "Seeens <hello@mail.seeens.com>"). Until then nothing is
// sent and callers fall back to a link to copy.
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(msg: { to: string; subject: string; text: string; replyTo?: string }) {
  if (!emailConfigured()) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}
