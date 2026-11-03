"use server";

import { loadDirectoryPage, readCursor, readDirectoryQuery } from "./directory";

// "Show More" on the directory: the next page after `after`, for the same
// filters as `query` (the directory URL's query string). Reads only, through
// RLS and the current workspace, like the page itself.
export async function loadMoreConnections(query: string, after: unknown) {
  const cursor = readCursor(after);
  if (!cursor) throw new Error("Couldn't load more.");
  const search = new URLSearchParams(query);
  const params: Record<string, string[]> = {};
  for (const [key, value] of search) (params[key] ??= []).push(value);
  const { items, next } = await loadDirectoryPage(readDirectoryQuery(params), { after: cursor, counts: false });
  return { items, next };
}
