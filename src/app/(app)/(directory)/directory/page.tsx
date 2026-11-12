import type { Metadata } from "next";
import { DirectoryView } from "../directory-view";

export const metadata: Metadata = { title: "Directory · Seeens" };

// The Directory (#273): every record this band can see, its own and what every
// other band shares. Home (/) is the band's own page.
export default function DirectoryPage({ searchParams }: PageProps<"/directory">) {
  return <DirectoryView searchParams={searchParams} />;
}
