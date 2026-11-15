"use client";

import { useRef, useState } from "react";
import { Add } from "@carbon/icons-react";
import { PhotoCopier, type CapturedPhoto, type PhotoProps } from "@/components/photo-copier";
import type { CopierSettings } from "@/lib/photos/settings";
import { initials } from "@/lib/connections/card";
import { Photo } from "@/components/photo";
import { imageSearchUrl } from "@/lib/photos/search";

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
          {photoUrl ? null : (
            <span className="photo-thumb-add">
              <Add size={12} />
              Photo
            </span>
          )}
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
  // Search Images (#321) uses what's typed so far: the name, type, and town.
  const [searchUrl, setSearchUrl] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const openCopier = () => {
    const form = box.current?.closest("form");
    const fd = form ? new FormData(form) : null;
    const name = String(fd?.get("name") ?? "").trim();
    setTypedName(name);
    setSearchUrl(
      name
        ? imageSearchUrl({
            name,
            kind: fd?.get("kind") === "person" ? "person" : "group",
            group_type: String(fd?.get("group_type") ?? "") || null,
            town:
              String(fd?.get("place_text") ?? "")
                .split(",")[0]
                .trim() || null,
          })
        : null,
    );
    setOpen(true);
  };
  return (
    <div ref={box} className="flex items-center gap-3">
      <button
        type="button"
        className="photo-thumb"
        onClick={openCopier}
        aria-label={photo ? "Change the photo" : "Add a photo"}
        aria-haspopup="dialog"
      >
        <span className="photo-thumb-empty" aria-hidden="true">
          {photo ? null : (
            <span className="photo-thumb-add">
              <Add size={12} />
              Photo
            </span>
          )}
        </span>
        {photo ? (
          // A local preview of the copy; it uploads with the save.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.copyUrl} alt={photo.alt} />
        ) : null}
      </button>
      <p className="text-sm text-muted">
        {photo ? "Uploads when you save." : "Optional. Run it through the Photo Copier now; it uploads when you save."}
      </p>
      <PhotoCopier
        connectionId=""
        workspaceId=""
        name={typedName || "the new listing"}
        photoUrl={photo?.copyUrl ?? null}
        originalUrl={photo?.originalUrl ?? null}
        photoPath={photo ? "pending" : null}
        originalPath={photo ? "pending" : null}
        settings={photo?.settings ?? null}
        alt={photo?.alt ?? null}
        defaults={defaults}
        searchUrl={searchUrl}
        capture={onChange}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
