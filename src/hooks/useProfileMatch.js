import { useState, useEffect, useRef, useCallback } from "react";
import { buildProfile, matchJobs, localProfile, localMatch } from "../services/profile.js";

const PROFILE_KEY = "oneboard:profile-v1";
const SEEN_KEY = "oneboard:onboarded-v1";

/**
 * How many jobs get sent to the AI for precise scoring. A live region can hold
 * a couple of thousand listings — far too many to put in one prompt, and most
 * are nowhere near the candidate's profile anyway. Must not exceed the server's
 * own cap (MATCH_LIMIT in server/ai.js), or the surplus comes back unscored.
 */
const SHORTLIST = 60;

function readProfile() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_KEY));
    return raw && typeof raw === "object" && raw.skills ? raw : null;
  } catch {
    return null;
  }
}

/** Whether this visitor has already been shown (and answered) the resume prompt. */
export function hasOnboarded() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked — don't nag on every page load
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* non-fatal */
  }
}

/** A stable signature for "this profile against this exact job set". */
const signature = (profile, jobs) =>
  profile ? `${profile.savedAt}:${jobs.map((j) => j.id).join(",")}` : "";

/**
 * Owns the resume profile and the match scores derived from it.
 *
 * The `match` it exposes is deliberately the same shape the query ranker
 * produces — { map: { [id]: { score, reason } }, q, mode } — so the existing
 * MatchRing, "why it fits" line and relevance sort all light up unchanged.
 *
 * Matching re-runs automatically whenever the job list or the profile changes,
 * which is what makes search results and region switches come back scored
 * without the caller having to orchestrate anything.
 */
export function useProfileMatch(jobs, { onMatched } = {}) {
  const [profile, setProfile] = useState(readProfile);
  const [match, setMatch] = useState(null);
  const [matching, setMatching] = useState(false);

  // Guards the auto-match effect against re-running for a job set we've already
  // scored — without this, every re-render would fire another round of API calls.
  const lastRun = useRef("");

  const runMatch = useCallback(
    async (p, list) => {
      if (!p || !list.length) return;

      const sig = signature(p, list);
      if (sig === lastRun.current) return;
      lastRun.current = sig;

      setMatching(true);

      // Retrieve, then re-rank. The local heuristic is cheap and scores the
      // whole feed, so it doubles as the baseline (every job gets a score, even
      // the long tail) and as the retrieval step that picks which jobs are worth
      // spending an AI call on. The AI then reads the actual job descriptions
      // for the strongest candidates and overwrites those scores with real ones.
      const base = localMatch(p, list);
      const shortlist = [...list]
        .sort((a, b) => base[b.id].score - base[a.id].score)
        .slice(0, SHORTLIST);

      const q = p.title || "your resume";
      try {
        const refined = await matchJobs(p, shortlist);
        setMatch({
          map: { ...base, ...refined },
          q,
          mode: p.mode === "local" ? "local" : "ai",
        });
      } catch {
        // Server AI unavailable (no key, rate limit, outage) — keep the local
        // baseline so the user still gets an ordered, explained feed, not an error.
        setMatch({ map: base, q, mode: "local" });
      } finally {
        setMatching(false);
        onMatched?.();
      }
    },
    [onMatched]
  );

  // Re-score whenever the profile or the loaded jobs change.
  useEffect(() => {
    if (profile && jobs.length) runMatch(profile, jobs);
  }, [profile, jobs, runMatch]);

  /**
   * Build a profile from the submitted resume + preferences, persist it, and
   * let the effect above score the current feed with it.
   */
  const saveProfile = useCallback(async (resumeText, prefs) => {
    let next;
    try {
      next = await buildProfile(resumeText, prefs);
    } catch (err) {
      // A 503 means the server has no API key — that's expected, so read the
      // resume locally. Anything else is a real failure worth surfacing.
      if (!/not configured/i.test(err.message)) throw err;
      next = localProfile(resumeText, prefs);
    }

    // savedAt makes the signature change on every resubmit, so editing the
    // profile always forces a fresh match even if the job list is identical.
    next = { ...next, savedAt: Date.now() };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode — profile just won't survive a reload */
    }
    markOnboarded();
    setProfile(next);
    return next;
  }, []);

  const clearProfile = useCallback(() => {
    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* non-fatal */
    }
    lastRun.current = "";
    setProfile(null);
    setMatch(null);
  }, []);

  return { profile, match, matching, saveProfile, clearProfile };
}
