// The directory, with a quick view beside it (#126). Clicking a row opens the
// connection in the @panel slot (an intercepted /connections/[id]) while the
// list stays put, filters and loaded pages included. Next intercepts from
// sibling pages too (route groups don't count), so the panel loads the full
// page when there's no directory under it. A refresh or shared link opens
// the full page as well.
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
