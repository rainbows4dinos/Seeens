"use client";

import { createPortal } from "react-dom";

// An empty <form> at the end of <body>, which fields join through their
// `form` attribute. This lets the Connections block sit inside the
// connection editor's form (on the edit page) without nesting forms, and
// Enter in a field here submits this form, not the editor.
export function DetachedForm({ id, action }: { id: string; action: (fd: FormData) => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(<form id={id} action={action} hidden />, document.body);
}
