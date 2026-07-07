import { Search, Loader2, Sparkles } from "lucide-react";
import { EXAMPLES } from "../data/constants.js";

/** Hero section with the natural-language search bar and example chips. */
export default function Hero({ query, setQuery, onSearch, aiLoading }) {
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
        Prism pulls openings from LinkedIn, Wellfound, RemoteOK and more into one place — then ranks them for you.
        Describe what you want in plain words.
      </p>

      <div className="searchbar">
        <Search size={19} style={{ color: "var(--t2)", flex: "none" }} />
        <input
          value={query}
          placeholder="e.g. senior frontend, remote, React + TypeScript, $150k+"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch(query);
          }}
          aria-label="Describe your ideal role"
        />
        <button className="btn btn-primary" onClick={() => onSearch(query)} disabled={aiLoading || !query.trim()}>
          {aiLoading ? (
            <>
              <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
              Ranking
            </>
          ) : (
            <>
              <Sparkles size={15} />
              Rank jobs
            </>
          )}
        </button>
        {aiLoading && <div className="progress" />}
      </div>

      <div className="examples">
        <span style={{ fontSize: 12.5, color: "var(--t2)", alignSelf: "center", fontWeight: 500 }}>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            className="ex-chip"
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
