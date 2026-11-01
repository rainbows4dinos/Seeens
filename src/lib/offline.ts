import { unstable_rethrow } from "next/navigation";

// Server action calls fail when the network drops, but they also reject on
// purpose when the action redirects: that's how Next hands the redirect to
// the router. Let those through so a successful save doesn't flash an error.
export function offline<T>(fallback: T) {
  return (e: unknown): T => {
    unstable_rethrow(e);
    return fallback;
  };
}
