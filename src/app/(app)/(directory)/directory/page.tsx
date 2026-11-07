import type { Metadata } from "next";
import { DirectoryView } from "../directory-view";

export const metadata: Metadata = { title: "Full Directory · Seeens" };

// The full directory (#192): every record this band can see, its own and
// what every other band shares.
export default function FullDirectoryPage({ searchParams }: PageProps<"/directory">) {
  return <DirectoryView searchParams={searchParams} scope="all" />;
}
