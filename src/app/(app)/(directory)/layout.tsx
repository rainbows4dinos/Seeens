// The directory, with a quick view beside it (#126). Clicking a row opens the
// connection in the @panel slot (an intercepted /connections/[id]) while the
// list stays put, filters and loaded pages included. Only this layout has the
// slot, so links and redirects anywhere else still open the full page, and
// a refresh or shared link does too.
//
// The shell is a size container: with the panel open the list narrows, and
// the bar and rows lay out for the room they have, not the window.
export default function DirectoryLayout({ children, panel }: LayoutProps<"/">) {
  return (
    <div className="directory-shell">
      {children}
      {panel}
    </div>
  );
}
