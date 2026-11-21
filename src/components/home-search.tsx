import { Search as SearchIcon } from "@carbon/icons-react";
import { noAutofill } from "@/lib/no-autofill";
import { SearchClear } from "@/components/search-clear";

// Search from Home: a plain GET form into the Directory's All tab, so it
// finds bands, people, venues, and labels alike, and works without script.
export function HomeSearch() {
  return (
    <form action="/directory" role="search" aria-label="Search the Directory" className="home-search">
      <input type="hidden" name="type" value="all" />
      <div className="search-field">
        <label htmlFor="home-q" className="sr-only">
          Search the Directory
        </label>
        <SearchIcon size={16} aria-hidden="true" />
        <input
          {...noAutofill}
          id="home-q"
          name="q"
          type="search"
          placeholder="Search the Directory"
          className="field"
          enterKeyHint="search"
          required
        />
        <kbd className="search-hint" aria-hidden="true">
          Enter
        </kbd>
        <SearchClear inputId="home-q" />
      </div>
    </form>
  );
}
