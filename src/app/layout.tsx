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

export const metadata: Metadata = {
  title: "Seeens",
  description: "Your people. Your scenes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
