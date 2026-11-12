"use client";

import { useEffect } from "react";

// Which button you just pressed, so only it shows it's working while it waits
// (disabled while saving): the metronome pointer after a beat (BusyPointer),
// a progress cursor until then. Other disabled buttons are just unavailable.
//
// The wait is over once the button is usable again, its form resets (React
// does that after a form action, and the button can stay disabled for another
// reason, like a cleared field), or another button is pressed. A button that
// doesn't go disabled right away isn't waiting on anything.
const STARTS_WITHIN_MS = 500;

export function PressedButton() {
  useEffect(() => {
    let pressed: HTMLButtonElement | null = null;
    let form: HTMLFormElement | null = null;
    let timer = 0;
    const watch = new MutationObserver(() => {
      if (pressed && !pressed.disabled) clear();
    });
    function clear() {
      pressed?.removeAttribute("data-pressed");
      pressed = null;
      form?.removeEventListener("reset", clear);
      form = null;
      clearTimeout(timer);
      watch.disconnect();
    }
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.("button");
      if (!(b instanceof HTMLButtonElement) || b.disabled) return;
      clear();
      pressed = b;
      b.setAttribute("data-pressed", "");
      watch.observe(b, { attributes: true, attributeFilter: ["disabled"] });
      form = b.form;
      form?.addEventListener("reset", clear);
      timer = window.setTimeout(() => {
        if (pressed === b && !b.disabled) clear();
      }, STARTS_WITHIN_MS);
    };
    // Back to a page the browser kept as it was: nothing's still working.
    const show = (e: PageTransitionEvent) => {
      if (e.persisted) clear();
    };
    document.addEventListener("click", onClick, true);
    addEventListener("pageshow", show);
    return () => {
      document.removeEventListener("click", onClick, true);
      removeEventListener("pageshow", show);
      clear();
    };
  }, []);
  return null;
}
