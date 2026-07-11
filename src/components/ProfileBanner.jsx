import { Sparkles, Loader2, SlidersHorizontal, X } from "lucide-react";

/**
 * Shown while a resume profile is driving the ranking. Mirrors RankedBanner
 * (which covers the query-ranked case) but surfaces the profile behind the
 * scores and offers a way to edit or drop it.
 */
export default function ProfileBanner({ profile, match, matching, onEdit, onClear }) {
  const detail = [profile.level, profile.years ? `${profile.years}y` : null, ...profile.skills.slice(0, 3)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="ranked">
      <div className="ic">
        {matching ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />}
      </div>
      <div className="txt">
        <div className="l1">
          {matching
            ? "Scoring roles against your resume…"
            : `Matched to your resume${match?.mode === "local" ? " · offline scoring" : ""}`}
        </div>
        <div className="l2">{profile.title ? `${profile.title} — ${detail}` : detail}</div>
      </div>
      <button
        className="icon-btn"
        onClick={onEdit}
        aria-label="Edit match profile"
        title="Edit your resume & preferences"
        style={{ flex: "none", width: 34, height: 34 }}
      >
        <SlidersHorizontal size={15} />
      </button>
      <button
        className="icon-btn"
        onClick={onClear}
        aria-label="Turn off resume matching"
        title="Turn off resume matching"
        style={{ flex: "none", width: 34, height: 34 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
