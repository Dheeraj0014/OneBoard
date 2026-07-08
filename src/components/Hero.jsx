import { Search, Loader2, Sparkles } from "lucide-react";
import { EXAMPLES } from "../data/constants.js";

/** Hero section with the natural-language search bar and example chips. */
export default function Hero({ query, setQuery, onSearch, loading, aiLoading }) {
  // Busy = fetching listings (loading) or AI-ranking them (aiLoading). Both
  // phases must block the search control so a re-click can't abort and restart
  // the in-flight request (which resets the multi-second fetch each time).
  const busy = loading || aiLoading;
  return (
    <section className="hero">
      <span className="eyebrow">
        <Sparkles size={13} />
        AI-powered job search
      </span>
      <h2>
        Find your next role, <span className="grad">without the tab overload.</span>
      </h2>
      <p>
        OneBoard pulls openings from LinkedIn, Wellfound, RemoteOK and more into one place — then ranks them for you.
        Describe what you want in plain words.
      </p>

      <div className="searchbar">
        <Search size={19} style={{ color: "var(--t2)", flex: "none" }} />
        <input
          value={query}
          placeholder="e.g. senior frontend, remote, React + TypeScript, $150k+"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) onSearch(query);
          }}
          aria-label="Describe your ideal role"
        />
        <button className="btn btn-primary" onClick={() => onSearch(query)} disabled={busy || !query.trim()}>
          {busy ? (
            <>
              <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
              {aiLoading ? "Ranking" : "Searching"}
            </>
          ) : (
            <>
              <Sparkles size={15} />
              Rank jobs
            </>
          )}
        </button>
        {busy && <div className="progress" />}
      </div>

      <div className="examples">
        <span style={{ fontSize: 12.5, color: "var(--t2)", alignSelf: "center", fontWeight: 500 }}>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            className="ex-chip"
            disabled={busy}
            onClick={() => {
              setQuery(ex);
              onSearch(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>
    </section>
  );
}
