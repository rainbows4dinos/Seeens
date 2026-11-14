// A Google Images search for a listing's photo (#321): a plain link the
// person opens themselves, scoped so the right band comes up first.
export function imageSearchUrl(c: {
  name: string;
  kind: "person" | "group";
  group_type: string | null;
  town?: string | null;
}) {
  const what = c.kind === "group" && c.group_type === "band" ? "band" : c.group_type === "venue" ? "venue" : "";
  const q = [`"${c.name.replace(/"/g, "")}"`, what, c.town ?? ""].filter(Boolean).join(" ");
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
}
