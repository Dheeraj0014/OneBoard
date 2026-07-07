import { useEffect } from "react";

/**
 * Locks body scroll while `locked` is true (e.g. when a modal/drawer is open).
 */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [locked]);
}
