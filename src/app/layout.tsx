import type { Metadata } from "next";
// Type from the Figma tokens, self-hosted (no request to Google at runtime):
// Hanken Grotesk for display and nav, IBM Plex Mono for body and UI,
// Reenie Beanie for the occasional handwritten note.
import "@fontsource-variable/hanken-grotesk/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "@fontsource/reenie-beanie/latin-400.css";
import "./globals.css";
import { RESTORE_POINTER_SCRIPT } from "@/lib/saved-pointer";
import { PressedButton } from "@/components/pressed-button";

export const metadata: Metadata = {
  title: "Seeens",
  description: "Your people. Your scenes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script may mark <html> before React starts, hence the warning off.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: RESTORE_POINTER_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <PressedButton />
      </body>
    </html>
  );
}
