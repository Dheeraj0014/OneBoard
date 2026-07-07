import { useState, useCallback } from "react";
import { rankJobs, localRank } from "../services/ai.js";

/**
 * Manages AI ranking state. `ai` is either null or
 * { map: { [id]: { score, reason } }, q, mode: "ai" | "local" }.
 *
 * @param {(msg: string) => void} [onRanked] optional callback fired after a run
 */
export function useJobRanking(onRanked) {
  const [ai, setAi] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const runAI = useCallback(
    async (text, jobs = []) => {
      const q = (text ?? "").trim();
      if (!q || !jobs.length) return;
      setAiLoading(true);
      try {
        const map = await rankJobs(q, jobs);
        setAi({ map, q, mode: "ai" });
      } catch {
        setAi({ map: localRank(q, jobs), q, mode: "local" });
      } finally {
        setAiLoading(false);
        onRanked?.();
      }
    },
    [onRanked]
  );

  const clearRank = useCallback(() => setAi(null), []);

  return { ai, aiLoading, runAI, clearRank };
}
