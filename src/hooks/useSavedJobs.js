import { useState, useCallback } from "react";

/**
 * Tracks the set of saved job ids and exposes a toggle.
 */
export function useSavedJobs() {
  const [saved, setSaved] = useState(() => new Set());

  const toggleSave = useCallback((id) => {
    setSaved((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  return { saved, toggleSave };
}
