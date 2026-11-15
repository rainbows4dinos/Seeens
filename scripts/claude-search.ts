// One Claude call with web search, shared by the Look up and Discover
// scripts (#321). Counts searches and tokens, so each run can say what it used.

const MODEL = process.env.LOOK_UP_MODEL || "claude-sonnet-5-5";
const API = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");

export const usage = { searches: 0, tokensIn: 0, tokensOut: 0 };

export function needKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY (in the environment or .env.local), or use --dry-run.");
    process.exit(1);
  }
}

/** Its text, and every page the search returned or the answer cited. */
export async function search(
  prompt: string,
  { maxSearches, maxTokens = 2000 }: { maxSearches: number; maxTokens?: number },
): Promise<{ text: string; searched: string[] }> {
  const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: prompt }];
  const searched: string[] = [];
  let text = "";
  for (let turn = 0; turn < 3; turn++) {
    const res = await call({
      model: MODEL,
      max_tokens: maxTokens,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }],
    });
    usage.tokensIn += res.usage?.input_tokens ?? 0;
    usage.tokensOut += res.usage?.output_tokens ?? 0;
    usage.searches += res.usage?.server_tool_use?.web_search_requests ?? 0;
    for (const block of res.content ?? []) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r?.url) searched.push(r.url);
      }
      if (block.type === "text") {
        text += block.text;
        for (const c of block.citations ?? []) if (c?.url) searched.push(c.url);
      }
    }
    // A long search turn can pause; send it back to let it finish.
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  return { text, searched };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(body: unknown, attempt = 0): Promise<any> {
  const res = await fetch(`${API}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 3) {
    await sleep(Number(res.headers.get("retry-after") ?? 0) * 1000 || 5000 * (attempt + 1));
    return call(body, attempt + 1);
  }
  if (!res.ok) throw new Error(`the API said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
