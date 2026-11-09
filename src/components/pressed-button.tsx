"use client";

import { useEffect } from "react";

// Which button you just pressed, so only it shows the progress cursor while
// it waits (disabled while saving). Other disabled buttons are just
// unavailable and keep a plain cursor. Cleared once it's usable again, or
// when another button is pressed.
export function PressedButton() {
  useEffect(() => {
    let pressed: HTMLButtonElement | null = null;
    const watch = new MutationObserver(() => {
      if (pressed && !pressed.disabled) clear();
    });
    function clear() {
      pressed?.removeAttribute("data-pressed");
      pressed = null;
      watch.disconnect();
    }
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.("button");
      if (!(b instanceof HTMLButtonElement) || b.disabled) return;
      clear();
      pressed = b;
      b.setAttribute("data-pressed", "");
      watch.observe(b, { attributes: true, attributeFilter: ["disabled"] });
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, []);
  return null;
}
