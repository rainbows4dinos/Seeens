import { Suspense, type ReactNode } from "react";
import { AppFooter, AppHeader } from "@/components/app-chrome";
import { BusyPointer } from "@/components/busy-pointer";
import { createClient } from "@/lib/supabase/server";

// About, Seeens & AI, What's New, and the Roadmap: public pages, built ahead
// of time. Signed in, they get the app's header and footer too, and the
// page's own logo and Sign In step aside (.signed-out-only in globals.css).
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={null}>
        <SignedIn>
          <AppHeader />
        </SignedIn>
      </Suspense>
      {children}
      <BusyPointer />
      <Suspense fallback={null}>
        <SignedIn>
          <AppFooter />
        </SignedIn>
      </Suspense>
    </div>
  );
}

async function SignedIn({ children }: { children: ReactNode }) {
  const { data } = await (await createClient()).auth.getClaims();
  return data?.claims?.sub ? children : null;
}
