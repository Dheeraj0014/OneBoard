import { useEffect } from "react";

/**
 * Calls `handler` whenever the Escape key is pressed.
 */
export function useEscapeKey(handler) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}
