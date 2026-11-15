"use server";

import { createClient } from "@/lib/supabase/server";

// Folded panels (#314), saved to each person's account so they follow them
// across devices. Null means nothing saved yet (or signed out, or it
// failed): panels then keep what this device remembers.

export async function loadFoldedPanels(): Promise<string[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_folded_panels");
  return error || !data ? null : data;
}

export async function savePanelFolded(id: string, folded: boolean): Promise<{ ok: boolean }> {
  if (!/^[a-z0-9-]{1,60}$/.test(id)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_panel_folded", { p_panel: id, p_folded: folded });
  return { ok: !error };
}
