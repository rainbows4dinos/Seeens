"use client";

import { useState } from "react";
import { PhotoCopier, type PhotoProps } from "@/components/photo-copier";
import { initials } from "@/lib/connections/card";

// The connection header's photo (Figma Connection view): a small square
// print, or initials on photo paper when there's none. It opens the copier.
export function PhotoPanel(props: PhotoProps) {
  const [open, setOpen] = useState(false);
  const { name, photoUrl, alt } = props;
  return (
    <>
      <button
        type="button"
        className="photo-thumb"
        onClick={() => setOpen(true)}
        aria-label={photoUrl ? `Change the photo of ${name}` : `Add a photo of ${name}`}
        aria-haspopup="dialog"
      >
        {photoUrl ? (
          // Signed storage links change on every load, so next/image's cache wouldn't help.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={alt ?? ""} />
        ) : (
          <span className="photo-thumb-empty" aria-hidden="true">
            <span className="card-print-initials">{initials(name)}</span>
            <span className="photo-thumb-add">+ Photo</span>
          </span>
        )}
      </button>
      <PhotoCopier {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
