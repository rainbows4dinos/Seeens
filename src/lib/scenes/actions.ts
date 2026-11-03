"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMembership } from "@/lib/auth/dal";
import { readPlace, resolveLocality, toLocalityChoice } from "@/lib/localities";
import { createClient } from "@/lib/supabase/server";

export type SceneFormValues = {
  name: string;
  description: string;
  parentId: string;
  placeId: string;
  placeText: string;
  keepLocalityId: string;
};

export type SceneFormState = {
  values: SceneFormValues;
  errors: Partial<Record<"name" | "parentId" | "placeText" | "form", string>>;
  attempt?: number;
};

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function saveScene(id: string | null, formData: FormData): Promise<SceneFormState> {
  const values: SceneFormValues = {
    name: str(formData, "name"),
    description: str(formData, "description"),
    parentId: str(formData, "parent_id"),
    ...readPlace(formData),
  };
  const errors: SceneFormState["errors"] = {};
  if (!values.name) errors.name = "Add a name.";
  else if (values.name.length > 120) errors.name = "Keep the name under 120 characters.";
  if (values.placeText && !/^\d+$/.test(values.placeId) && !values.keepLocalityId) {
    errors.placeText = "Pick a town from the suggestions, or clear the field.";
  }

  const membership = await getMembership();
  if (!membership) redirect("/");
  const supabase = await createClient();

  if (values.parentId) {
    const { data: parent } = await supabase
      .from("scenes")
      .select("id, parent_id")
      .eq("id", values.parentId)
      .eq("workspace_id", membership.workspaceId)
      .maybeSingle();
    const { count: children } = id
      ? await supabase
          .from("scenes")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", id)
          .eq("workspace_id", membership.workspaceId)
      : { count: 0 };
    if (!parent || parent.id === id || parent.parent_id) errors.parentId = "Pick a top-level scene.";
    else if (children) errors.parentId = "This scene has scenes inside it, so it can't go inside another one.";
  }

  if (Object.keys(errors).length) return { values, errors, attempt: Date.now() };

  let sceneId = id;
  try {
    const localityId = await resolveLocality(supabase, membership.workspaceId, toLocalityChoice(values));
    const row = {
      name: values.name,
      description: values.description || null,
      parent_id: values.parentId || null,
      locality_id: localityId,
    };
    if (id) {
      const { data, error } = await supabase
        .from("scenes")
        .update(row)
        .eq("id", id)
        .eq("workspace_id", membership.workspaceId)
        .select("id");
      if (error) throw error;
      if (!data.length) throw new Error("not found");
    } else {
      const { data, error } = await supabase
        .from("scenes")
        .insert({ workspace_id: membership.workspaceId, ...row })
        .select("id")
        .single();
      if (error) throw error;
      sceneId = data.id;
    }
  } catch (error) {
    const e = error as { code?: string };
    return {
      values,
      errors:
        e?.code === "23505"
          ? { name: "There's already a scene with that name." }
          : { form: "Couldn't save. Your changes are still here; try again." },
      attempt: Date.now(),
    };
  }

  revalidatePath("/", "layout");
  redirect(`/scenes?saved=${sceneId}`);
}

export async function createScene(_prev: SceneFormState, formData: FormData) {
  return saveScene(null, formData);
}

export async function updateScene(id: string, _prev: SceneFormState, formData: FormData) {
  return saveScene(id, formData);
}

// Removing a scene untags its connections; the connections stay, and
// scenes inside it become top-level.
export async function removeScene(id: string): Promise<{ error?: string }> {
  const membership = await getMembership();
  if (!membership) return { error: "You're not in a workspace." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scenes")
    .delete()
    .eq("id", id)
    .eq("workspace_id", membership.workspaceId)
    .select("id");
  if (error || !data.length) return { error: "Couldn't remove the scene. Try again." };
  revalidatePath("/", "layout");
  redirect("/scenes");
}
