"use client";

// A connection photo that loads in: while it's on its way the print shows a
// copier's light bar sweeping down (CSS, on the parent), then the photo fades
// in. If it fails, it steps aside and the initials underneath stay.
export function Photo(props: Omit<React.ComponentProps<"img">, "onLoad" | "onError" | "ref">) {
  return (
    // Served from /api/photos at a stable, cached address; next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={props.alt ?? ""}
      data-loading=""
      // Cached photos can finish before the page is interactive, before onLoad is wired.
      ref={(img) => {
        if (img?.complete) settle(img);
      }}
      onLoad={(e) => settle(e.currentTarget)}
      onError={(e) => settle(e.currentTarget)}
    />
  );
}

function settle(img: HTMLImageElement) {
  img.removeAttribute("data-loading");
  if (img.complete && img.naturalWidth === 0) img.hidden = true;
}
