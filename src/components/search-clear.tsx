"use client";

import { CloseFilled } from "@carbon/icons-react";

// Figma Field "Show Clear": empties the search box and searches again, so the
// directory goes back to the whole list. CSS hides it while the box is empty.
export function SearchClear({ inputId }: { inputId: string }) {
  return (
    <button
      type="button"
      className="search-clear"
      aria-label="Clear search"
      onClick={(e) => {
        const input = document.getElementById(inputId);
        if (!(input instanceof HTMLInputElement)) return;
        input.value = "";
        input.focus();
        e.currentTarget.form?.requestSubmit();
      }}
    >
      <CloseFilled size={16} aria-hidden="true" />
    </button>
  );
}
