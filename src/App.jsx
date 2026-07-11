import { useState, useCallback, useMemo } from "react";
import { RotateCcw } from "lucide-react";

import { useToast } from "./hooks/useToast.js";
import { useSavedJobs } from "./hooks/useSavedJobs.js";
import { useJobFilters } from "./hooks/useJobFilters.js";
import { useJobRanking } from "./hooks/useJobRanking.js";
import { useFilteredJobs } from "./hooks/useFilteredJobs.js";
import { useJobs } from "./hooks/useJobs.js";
import { useAuthGate } from "./hooks/useAuthGate.js";
import { useEscapeKey } from "./hooks/useEscapeKey.js";
import { useBodyScrollLock } from "./hooks/useBodyScrollLock.js";
import { useProfileMatch, hasOnboarded, markOnboarded } from "./hooks/useProfileMatch.js";
import { deriveSkills, deriveSources } from "./utils/derive.js";
import { detectCountry } from "./data/countries.js";

import TopBar from "./components/TopBar.jsx";
import Hero from "./components/Hero.jsx";
import Filters from "./components/Filters.jsx";
import Toolbar from "./components/Toolbar.jsx";
import RankedBanner from "./components/RankedBanner.jsx";
import ProfileBanner from "./components/ProfileBanner.jsx";
import ResumePrompt from "./components/ResumePrompt.jsx";
import ResumeModal from "./components/ResumeModal.jsx";
import JobList from "./components/JobList.jsx";
import FilterDrawer from "./components/FilterDrawer.jsx";
import JobDetail from "./components/JobDetail.jsx";
import Footer from "./components/Footer.jsx";
import Toast from "./components/Toast.jsx";

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState(detectCountry);
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("all"); // "all" | "saved"
  const [selected, setSelected] = useState(null);
  const [drawer, setDrawer] = useState(false);
  // First-time visitors are met with the resume prompt; returning ones aren't.
  const [resumeOpen, setResumeOpen] = useState(() => !hasOnboarded());
  const [promptDismissed, setPromptDismissed] = useState(false);

  const { toast, showToast } = useToast();
  const { saved, toggleSave } = useSavedJobs();
  const requireAuth = useAuthGate();
  // Saving a role requires sign-in; otherwise the Clerk sign-in modal opens.
  const handleSave = useMemo(() => requireAuth(toggleSave), [requireAuth, toggleSave]);
  const { f, setF, resetFilters, activeFilters } = useJobFilters();
  const { jobs, loading, error, loadJobs } = useJobs(country);

  // Ranking has two sources. A resume profile scores the whole feed and
  // re-scores it on every search or region change; without one, a search falls
  // back to ranking against the query text alone.
  const showRelevance = useCallback(() => setSort("relevance"), []);
  const { ai: rank, aiLoading, runAI, clearRank } = useJobRanking(showRelevance);
  const { profile, match, matching, saveProfile, clearProfile } = useProfileMatch(jobs, {
    onMatched: showRelevance,
  });

  // Both produce the same { map, q, mode } shape, so everything downstream —
  // the score ring, the "why it fits" line, the relevance sort — is agnostic
  // about which one is driving. The profile wins when the user has one.
  const ai = profile ? match : rank;

  const { counts, results } = useFilteredJobs({ jobs, view, saved, f, ai, sort });

  // Filter facets are derived from the live listings.
  const allSkills = useMemo(() => deriveSkills(jobs), [jobs]);
  const sources = useMemo(() => deriveSources(jobs), [jobs]);

  const closeResume = useCallback(() => {
    markOnboarded(); // dismissing counts as an answer — don't reopen next visit
    setResumeOpen(false);
  }, []);

  // Close modals with Escape; lock body scroll while any is open.
  useEscapeKey(
    useCallback(() => {
      setSelected(null);
      setDrawer(false);
      setResumeOpen(false);
    }, [])
  );
  useBodyScrollLock(Boolean(selected) || drawer || resumeOpen);

  // Search = fetch live jobs for the query, then rank the results. With a
  // profile, useProfileMatch re-scores the new list on its own, so ranking by
  // the query text as well would only overwrite better scores with worse ones.
  const handleSearch = useCallback(
    async (text) => {
      const q = (text ?? "").trim();
      if (!q) return;
      setView("all");
      setDrawer(false);
      const list = await loadJobs(q, country);
      if (!profile) runAI(q, list);
    },
    [loadJobs, runAI, country, profile]
  );

  // Changing the region refetches the current query (or catalog) for that
  // country, then re-ranks if there's an active search.
  const handleCountryChange = useCallback(
    async (code) => {
      if (code === country) return;
      setCountry(code);
      const q = query.trim();
      const list = await loadJobs(q, code);
      if (q && !profile) runAI(q, list);
    },
    [country, query, loadJobs, runAI, profile]
  );

  // Building the profile flips the whole feed into resume-matched order.
  const handleResumeSubmit = useCallback(
    async (resumeText, prefs) => {
      await saveProfile(resumeText, prefs);
      clearRank(); // a stale query ranking would sit behind the profile scores
      setResumeOpen(false);
      showToast("Resume saved — scoring your feed");
    },
    [saveProfile, clearRank, showToast]
  );

  const handleClearProfile = useCallback(() => {
    clearProfile();
    setSort("newest");
    setPromptDismissed(true); // they just turned it off; don't immediately re-ask
    showToast("Resume matching turned off");
  }, [clearProfile, showToast]);

  const handleClearRank = useCallback(() => {
    clearRank();
    setSort("newest");
    setQuery("");
    loadJobs("", country); // restore the full live catalog for the region
  }, [clearRank, loadJobs, country]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const toggleSavedView = () => setView((v) => (v === "saved" ? "all" : "saved"));

  return (
    <div className="prism-root" data-theme={theme}>
      <div className="orb orb-a" />
      <div className="orb orb-b" />

      <div style={{ position: "relative", zIndex: 1 }}>
        <TopBar
          theme={theme}
          onToggleTheme={toggleTheme}
          view={view}
          onToggleSaved={toggleSavedView}
          savedCount={saved.size}
          activeFilters={activeFilters}
          onOpenDrawer={() => setDrawer(true)}
        />

        <main className="wrap">
          <Hero query={query} setQuery={setQuery} onSearch={handleSearch} loading={loading} aiLoading={aiLoading} />

          <div className="layout">
            <aside className="sidebar sidebar-static">
              {activeFilters > 0 && (
                <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={resetFilters}>
                  <RotateCcw size={14} />
                  Reset filters · {activeFilters}
                </button>
              )}
              <Filters
                f={f}
                set={setF}
                counts={counts}
                sources={sources}
                allSkills={allSkills}
                country={country}
                onCountryChange={handleCountryChange}
                countryLoading={loading}
              />
            </aside>

            <section>
              <Toolbar
                view={view}
                setView={setView}
                count={results.length}
                ai={ai}
                sort={sort}
                setSort={setSort}
                savedCount={saved.size}
                boardCount={sources.length}
              />

              {profile ? (
                <ProfileBanner
                  profile={profile}
                  match={match}
                  matching={matching}
                  onEdit={() => setResumeOpen(true)}
                  onClear={handleClearProfile}
                />
              ) : (
                <>
                  {ai && <RankedBanner ai={ai} onClear={handleClearRank} />}
                  {!promptDismissed && !resumeOpen && jobs.length > 0 && (
                    <ResumePrompt
                      onOpen={() => setResumeOpen(true)}
                      onDismiss={() => setPromptDismissed(true)}
                    />
                  )}
                </>
              )}

              <JobList
                results={results}
                saved={saved}
                onSave={handleSave}
                onOpen={setSelected}
                ai={ai}
                view={view}
                activeFilters={activeFilters}
                onReset={resetFilters}
                loading={loading}
                error={error}
                onRetry={() => loadJobs(query, country)}
              />
            </section>
          </div>
        </main>

        <Footer />
      </div>

      {drawer && (
        <FilterDrawer
          f={f}
          setF={setF}
          counts={counts}
          sources={sources}
          allSkills={allSkills}
          country={country}
          onCountryChange={handleCountryChange}
          countryLoading={loading}
          activeFilters={activeFilters}
          onReset={resetFilters}
          onClose={() => setDrawer(false)}
        />
      )}

      {resumeOpen && (
        <ResumeModal
          profile={profile}
          allSkills={allSkills}
          onSubmit={handleResumeSubmit}
          onSkip={closeResume}
          onClose={closeResume}
        />
      )}

      {selected && (
        <JobDetail
          job={selected}
          saved={saved.has(selected.id)}
          onSave={handleSave}
          onClose={() => setSelected(null)}
          rank={ai ? ai.map[selected.id] : null}
          toast={showToast}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
