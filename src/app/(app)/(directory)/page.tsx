import type { Metadata } from "next";
import { DirectoryView } from "./directory-view";

export const metadata: Metadata = { title: "My Network · Seeens" };

// My Network (#192): what this band added or has touched.
export default function MyNetworkPage({ searchParams }: PageProps<"/">) {
  return <DirectoryView searchParams={searchParams} scope="network" />;
}
