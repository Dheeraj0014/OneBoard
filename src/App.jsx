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
import { deriveSkills, deriveSources } from "./utils/derive.js";
import { detectCountry } from "./data/countries.js";

import TopBar from "./components/TopBar.jsx";
import Hero from "./components/Hero.jsx";
import Filters from "./components/Filters.jsx";
import Toolbar from "./components/Toolbar.jsx";
import RankedBanner from "./components/RankedBanner.jsx";
import JobList from "./components/JobList.jsx";
import FilterDrawer from "./components/FilterDrawer.jsx";
import JobDetail from "./components/JobDetail.jsx";
import Toast from "./components/Toast.jsx";

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState(detectCountry);
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("all"); // "all" | "saved"
  const [selected, setSelected] = useState(null);
  const [drawer, setDrawer] = useState(false);

  const { toast, showToast } = useToast();
  const { saved, toggleSave } = useSavedJobs();
  const requireAuth = useAuthGate();
  // Saving a role requires sign-in; otherwise the Clerk sign-in modal opens.
  const handleSave = useMemo(() => requireAuth(toggleSave), [requireAuth, toggleSave]);
  const { f, setF, resetFilters, activeFilters } = useJobFilters();
  const { jobs, loading, error, loadJobs } = useJobs(country);
  const { ai, aiLoading, runAI, clearRank } = useJobRanking(
    useCallback(() => setSort("relevance"), [])
  );
  const { counts, results } = useFilteredJobs({ jobs, view, saved, f, ai, sort });

  // Filter facets are derived from the live listings.
  const allSkills = useMemo(() => deriveSkills(jobs), [jobs]);
  const sources = useMemo(() => deriveSources(jobs), [jobs]);

  // Close modals with Escape; lock body scroll while any is open.
  useEscapeKey(
    useCallback(() => {
      setSelected(null);
      setDrawer(false);
    }, [])
  );
  useBodyScrollLock(Boolean(selected) || drawer);

  // Search = fetch live jobs for the query, then rank the results with AI.
  const handleSearch = useCallback(
    async (text) => {
      const q = (text ?? "").trim();
      if (!q) return;
      setView("all");
      setDrawer(false);
      const list = await loadJobs(q, country);
      runAI(q, list);
    },
    [loadJobs, runAI, country]
  );

  // Changing the region refetches the current query (or catalog) for that
  // country, then re-ranks if there's an active search.
  const handleCountryChange = useCallback(
    async (code) => {
      if (code === country) return;
      setCountry(code);
      const q = query.trim();
      const list = await loadJobs(q, code);
      if (q) runAI(q, list);
    },
    [country, query, loadJobs, runAI]
  );

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

              {ai && <RankedBanner ai={ai} onClear={handleClearRank} />}

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
