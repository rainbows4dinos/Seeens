import { Suspense, type ReactNode } from "react";
import { ModeratorWelcome } from "@/components/moderator-welcome";
import { BusyPointer } from "@/components/busy-pointer";
import { AppFooter, AppHeader } from "@/components/app-chrome";
import { createClient } from "@/lib/supabase/server";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="page-gutter w-full flex-1 pt-8 pb-16">
        <Suspense fallback={null}>
          <NewModeratorNote />
        </Suspense>
        {children}
      </main>
      <BusyPointer />
      <AppFooter />
    </div>
  );
}

// A note for someone just made a moderator, until they dismiss it.
async function NewModeratorNote() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("moderator_welcome_pending");
  return data ? <ModeratorWelcome /> : null;
}
