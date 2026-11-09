"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMemberships, rememberBand } from "@/lib/auth/dal";

// Look at another of your bands (#68). Remembered on this browser; every
// page then shows that band. Only bands you're in.
export async function switchBand(formData: FormData) {
  const id = String(formData.get("workspace_id") ?? "");
  const mine = await getMemberships();
  if (mine.some((m) => m.workspaceId === id)) await rememberBand(id);
  revalidatePath("/", "layout");
  redirect("/");
}
