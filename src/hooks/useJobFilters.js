import { useState, useCallback, useMemo } from "react";

/** Fresh, empty filter state. Each call returns new Sets. */
const makeEmptyFilters = () => ({
  sources: new Set(),
  remote: new Set(),
  level: new Set(),
  type: new Set(),
  skills: new Set(),
  salaryMin: 0,
});

/**
 * Owns the filter state, a reset action and a derived active-filter count.
 */
export function useJobFilters() {
  const [f, setF] = useState(makeEmptyFilters);

  const resetFilters = useCallback(() => setF(makeEmptyFilters()), []);

  const activeFilters = useMemo(
    () =>
      f.sources.size +
      f.remote.size +
      f.level.size +
      f.type.size +
      f.skills.size +
      (f.salaryMin ? 1 : 0),
    [f]
  );

  return { f, setF, resetFilters, activeFilters };
}
