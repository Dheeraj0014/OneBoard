import { sourceColor, REMOTES, LEVELS, TYPES } from "../data/constants.js";
import FilterOption from "./FilterOption.jsx";

/**
 * The full set of filter controls (sources, workplace, experience, type,
 * salary and skills). Source and skill options are derived from the live job
 * list and passed in. Shared between the desktop sidebar and mobile drawer.
 */
export default function Filters({ f, set, counts, sources = [], allSkills = [] }) {
  const toggle = (key, val) =>
    set((p) => {
      const s = new Set(p[key]);
      s.has(val) ? s.delete(val) : s.add(val);
      return { ...p, [key]: s };
    });

  return (
    <>
      <div className="fgroup">
        <div className="fhead">
          <span>Source</span>
        </div>
        {sources.map((s) => (
          <FilterOption
            key={s}
            active={f.sources.has(s)}
            onToggle={() => toggle("sources", s)}
            dot={sourceColor(s)}
            label={s}
            count={counts.source[s] || 0}
          />
        ))}
      </div>

      <div className="fgroup">
        <div className="fhead">
          <span>Workplace</span>
        </div>
        {REMOTES.map((r) => (
          <FilterOption
            key={r}
            active={f.remote.has(r)}
            onToggle={() => toggle("remote", r)}
            label={r}
            count={counts.remote[r] || 0}
          />
        ))}
      </div>

      <div className="fgroup">
        <div className="fhead">
          <span>Experience</span>
        </div>
        {LEVELS.map((l) => (
          <FilterOption
            key={l}
            active={f.level.has(l)}
            onToggle={() => toggle("level", l)}
            label={l}
            count={counts.level[l] || 0}
          />
        ))}
      </div>

      <div className="fgroup">
        <div className="fhead">
          <span>Type</span>
        </div>
        {TYPES.filter((t) => counts.type[t]).map((t) => (
          <FilterOption
            key={t}
            active={f.type.has(t)}
            onToggle={() => toggle("type", t)}
            label={t}
            count={counts.type[t] || 0}
          />
        ))}
      </div>

      <div className="fgroup rangewrap">
        <div className="fhead">
          <span>Minimum salary</span>
          <span className="rangeval">${f.salaryMin}k+</span>
        </div>
        <input
          type="range"
          min="0"
          max="250"
          step="10"
          value={f.salaryMin}
          aria-label="Minimum salary"
          onChange={(e) => set((p) => ({ ...p, salaryMin: +e.target.value }))}
        />
      </div>

      <div className="fgroup">
        <div className="fhead">
          <span>Skills</span>
        </div>
        <div className="pills">
          {allSkills.map((s) => (
            <button
              key={s}
              className={`pill${f.skills.has(s) ? " on" : ""}`}
              onClick={() => toggle("skills", s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
