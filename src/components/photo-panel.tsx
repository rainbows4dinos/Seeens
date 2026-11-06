"use client";

import { useState } from "react";
import { Add } from "@carbon/icons-react";
import { PhotoCopier, type CapturedPhoto, type PhotoProps } from "@/components/photo-copier";
import type { CopierSettings } from "@/lib/photos/settings";
import { initials } from "@/lib/connections/card";
import { Photo } from "@/components/photo";

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
        <span className="photo-thumb-empty" aria-hidden="true">
          <span className="card-print-initials">{initials(name)}</span>
          {photoUrl ? null : <span className="photo-thumb-add">
            <Add size={12} />
            Photo
          </span>}
        </span>
        {/* A photo that fails to load steps aside, leaving the initials. */}
        {photoUrl ? <Photo key={photoUrl} src={photoUrl} alt={alt ?? ""} /> : null}
      </button>
      <PhotoCopier {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// The Add form's photo: picked and copied now, uploaded once the connection
// is saved (the copier hands back the files instead of uploading them).
export function NewPhotoPanel({
  photo,
  defaults,
  onChange,
}: {
  photo: CapturedPhoto | null;
  defaults: CopierSettings;
  onChange: (photo: CapturedPhoto | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="photo-thumb"
        onClick={() => setOpen(true)}
        aria-label={photo ? "Change the photo" : "Add a photo"}
        aria-haspopup="dialog"
      >
        <span className="photo-thumb-empty" aria-hidden="true">
          {photo ? null : <span className="photo-thumb-add">
            <Add size={12} />
            Photo
          </span>}
        </span>
        {photo ? (
          // A local preview of the copy; it uploads with the save.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.copyUrl} alt={photo.alt} />
        ) : null}
      </button>
      <p className="text-sm text-muted">{photo ? "Uploads when you save." : "Optional. Run it through the copier now; it uploads when you save."}</p>
      <PhotoCopier
        connectionId=""
        workspaceId=""
        name="the new connection"
        photoUrl={photo?.copyUrl ?? null}
        originalUrl={photo?.originalUrl ?? null}
        photoPath={photo ? "pending" : null}
        originalPath={photo ? "pending" : null}
        settings={photo?.settings ?? null}
        alt={photo?.alt ?? null}
        defaults={defaults}
        capture={onChange}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
