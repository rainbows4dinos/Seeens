"use client";

import { noAutofill } from "@/lib/no-autofill";
import { useState } from "react";
import { Field, invalid } from "@/components/form-field";
import { LINK_TYPES, detectLinkType, splitLinkLabel, type LinkType } from "@/lib/connections/link-types";

// A connection's own links (Bandcamp, Instagram…): URL, type, and a label
// for Other. Posts link_url, link_type, and link_label, one each per row.
// Used on the Add form and the profile page's Contact & Links (#126).
export function LinksEditor({
  initial,
  errors,
}: {
  initial: { label: string; url: string }[];
  /** By row index. */
  errors?: Record<number, string>;
}) {
  const [links, setLinks] = useState(() =>
    (initial.length ? initial : [{ label: "", url: "" }]).map((l, i) => {
      const { type, custom } = splitLinkLabel(l.label);
      // Untyped links pick up a type from their URL until someone chooses one.
      return { key: i, url: l.url, type: type || detectLinkType(l.url) || "", custom, auto: !type };
    }),
  );
  const updateLink = (key: number, patch: Partial<(typeof links)[number]>) =>
    setLinks((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const [nextKey, setNextKey] = useState(links.length);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="label">Links</legend>
      {links.map((link, i) => {
        const err = errors?.[i];
        const other = link.type === "Other";
        const n = <span className="sr-only"> for link {i + 1}</span>;
        return (
          <div
            key={link.key}
            className={`panel grid gap-2 p-3 sm:items-end ${other ? "sm:grid-cols-[2fr_1fr_1fr_auto]" : "sm:grid-cols-[2fr_1fr_auto]"}`}
          >
            <Field id={`c-link_url_${link.key}`} label={<>URL{n}</>} error={err}>
              <input
                {...noAutofill}
                id={`c-link_url_${link.key}`}
                name="link_url"
                type="url"
                inputMode="url"
                value={link.url}
                onChange={(e) => {
                  const url = e.target.value;
                  updateLink(link.key, link.auto ? { url, type: detectLinkType(url) ?? "" } : { url });
                }}
                placeholder="yourband.bandcamp.com"
                className="field"
                {...invalid(`c-link_url_${link.key}`, err)}
              />
            </Field>
            <Field id={`c-link_type_${link.key}`} label={<>Link Type{n}</>}>
              <select
                id={`c-link_type_${link.key}`}
                name="link_type"
                value={link.type}
                onChange={(e) => updateLink(link.key, { type: e.target.value as LinkType | "", auto: false })}
                className="field"
              >
                <option value="">Choose one</option>
                {LINK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            {other ? (
              <Field id={`c-link_label_${link.key}`} label={<>Label{n}</>}>
                <input
                  {...noAutofill}
                  id={`c-link_label_${link.key}`}
                  name="link_label"
                  value={link.custom}
                  onChange={(e) => updateLink(link.key, { custom: e.target.value })}
                  placeholder="Merch store"
                  className="field"
                />
              </Field>
            ) : (
              <input type="hidden" name="link_label" value="" />
            )}
            <button
              type="button"
              className="button-secondary"
              onClick={() => setLinks((ls) => ls.filter((l) => l.key !== link.key))}
              aria-label={`Remove link ${i + 1}`}
            >
              Remove
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="button-secondary self-start"
        onClick={() => {
          setLinks((ls) => [...ls, { key: nextKey, url: "", type: "", custom: "", auto: true }]);
          setNextKey((k) => k + 1);
        }}
      >
        Add a Link
      </button>
    </fieldset>
  );
}
