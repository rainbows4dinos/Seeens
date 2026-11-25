// Shared responses for the API routes (#372).

/** For anything about one band or one person: never cached by a shared cache, never indexed. */
export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } as const;

/** A plain-text error people can read, kept private. */
export function fail(status: number, message: string): Response {
  return new Response(message, { status, headers: PRIVATE_HEADERS });
}

/** Nothing here, or nothing you can see: the same 404 either way, so it doesn't say which. */
export function notFound(): Response {
  return new Response(null, { status: 404, headers: PRIVATE_HEADERS });
}
