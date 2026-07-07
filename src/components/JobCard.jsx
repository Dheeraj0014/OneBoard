import { Sparkles, Clock, Heart } from "lucide-react";
import { sourceColor } from "../data/constants.js";
import { fmtSal, ago, initials } from "../utils/format.js";
import RemoteTag from "./RemoteTag.jsx";
import MatchRing from "./MatchRing.jsx";

/** A single job listing row in the results grid. */
export default function JobCard({ job, saved, onSave, onOpen, rank, i }) {
  return (
    <div
      className="card reveal"
      style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
      onClick={() => onOpen(job)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(job);
      }}
    >
      <div className="crow">
        <div className="avatar">{initials(job.company)}</div>
        <div className="cmid">
          <h3 className="ctitle">
            {job.title}
            {job.source === "TheirStack" && (
              <span className="badge-india" title="Indian job market">
                🇮🇳 India
              </span>
            )}
          </h3>
          <div className="cmeta">
            <span style={{ color: "var(--t0)", fontWeight: 500 }}>{job.company}</span>
            <span className="dot" />
            <RemoteTag v={job.remote} />
            {job.remote !== "Remote" && job.location && (
              <>
                <span className="dot" />
                <span>{job.location}</span>
              </>
            )}
            {job.min != null && (
              <>
                <span className="dot" />
                <span className="sal">{fmtSal(job.min, job.max)}</span>
              </>
            )}
          </div>
          {job.skills?.length > 0 && (
            <div className="skills">
              {job.skills.slice(0, 4).map((s) => (
                <span key={s} className="skill">
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="cfoot">
            <span className="src">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: sourceColor(job.source) }} />
              {job.source}
            </span>
            <span className="dot" />
            <span>{job.type}</span>
            <span className="dot" />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} />
              {ago(job.posted)}
            </span>
          </div>
        </div>
        <div className="cright">
          {rank && <MatchRing score={rank.score} />}
          <button
            className={`savebtn${saved ? " on" : ""}`}
            aria-label={saved ? "Remove from saved" : "Save role"}
            onClick={(e) => {
              e.stopPropagation();
              onSave(job.id);
            }}
          >
            <Heart size={16} fill={saved ? "#ec4899" : "none"} strokeWidth={2} />
          </button>
        </div>
      </div>
      {rank?.reason && (
        <div className="reason">
          <Sparkles size={15} style={{ color: "var(--accent)", flex: "none", marginTop: 1 }} />
          <span className="rt">
            <b>Why it fits — </b>
            {rank.reason}
          </span>
        </div>
      )}
    </div>
  );
}
