import { useState, useCallback } from "react";
import {
  X, Sparkles, Check, Loader2, Copy, RotateCcw, ArrowUpRight, Heart,
} from "lucide-react";
import { useAuth, useClerk } from "@clerk/react";
import { sourceColor, REMOTE, LEVEL_EXP } from "../data/constants.js";
import { fmtSal, initials } from "../utils/format.js";
import { draftIntro } from "../services/ai.js";
import MatchRing from "./MatchRing.jsx";

/** Slide-over panel with the full job details and the AI intro drafter. */
export default function JobDetail({ job, saved, onSave, onClose, rank, toast }) {
  const [intro, setIntro] = useState("");
  const [loading, setLoading] = useState(false);
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const m = REMOTE[job.remote];
  const Icon = m.icon;

  const draft = useCallback(async () => {
    setLoading(true);
    setIntro("");
    try {
      setIntro((await draftIntro(job)) || "Couldn't draft that one — try again in a moment.");
    } catch {
      setIntro(
        `I'm reaching out about the ${job.title} role at ${job.company}. My work centers on ${job.skills
          .slice(0, 2)
          .join(" and ")}, and the way your team ships makes this feel like a natural fit. I'd love to share how I could contribute and learn more about what you're building.`
      );
    } finally {
      setLoading(false);
    }
  }, [job]);

  const copy = () => {
    try {
      navigator.clipboard.writeText(intro);
      toast("Intro copied to clipboard");
    } catch {
      toast("Select the text to copy it");
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="panel" role="dialog" aria-label={`${job.title} at ${job.company}`}>
        <div className="phead">
          <div className="avatar" style={{ width: 52, height: 52 }}>
            {initials(job.company)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.02em", margin: "2px 0 4px" }}>
              {job.title}
            </h2>
            <div className="cmeta">
              <span style={{ color: "var(--t0)", fontWeight: 500 }}>{job.company}</span>
              <span className="dot" />
              <span className="src">
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: sourceColor(job.source) }} />
                via {job.source}
              </span>
            </div>
          </div>
          {rank && <MatchRing score={rank.score} size={54} />}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="pbody">
          {rank?.reason && (
            <div className="reason" style={{ marginTop: 0 }}>
              <Sparkles size={15} style={{ color: "var(--accent)", flex: "none", marginTop: 1 }} />
              <span className="rt">
                <b>AI match — </b>
                {rank.reason}
              </span>
            </div>
          )}
          <div className="pgrid">
            <div className="pcell">
              <div className="k">Compensation</div>
              <div className="v" style={{ fontFamily: "var(--mono)" }}>
                {fmtSal(job.min, job.max) || "Not disclosed"}
              </div>
            </div>
            <div className="pcell">
              <div className="k">Workplace</div>
              <div className="v" style={{ color: m.c, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon size={15} />
                {job.remote}
              </div>
            </div>
            <div className="pcell">
              <div className="k">Location</div>
              <div className="v">{job.location || "—"}</div>
            </div>
            <div className="pcell">
              <div className="k">Experience</div>
              <div className="v">
                {job.level} · {LEVEL_EXP[job.level]}
              </div>
            </div>
          </div>

          {job.summary && (
            <>
              <div className="sect-h">About the role</div>
              <p className="desc">{job.summary}</p>
            </>
          )}

          {job.resp?.length > 0 && (
            <>
              <div className="sect-h">What you'll do</div>
              <ul className="resp">
                {job.resp.map((r) => (
                  <li key={r}>
                    <span className="ci">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </>
          )}

          {job.skills?.length > 0 && (
            <>
              <div className="sect-h">Skills</div>
              <div className="skills" style={{ marginTop: 0 }}>
                {job.skills.map((s) => (
                  <span key={s} className="skill">
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="sect-h" style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Sparkles size={13} style={{ color: "var(--accent)" }} />
            Draft an intro with AI
          </div>
          <div className="intro-box">
            {!intro && !loading && (
              <>
                <p style={{ fontSize: 13.5, color: "var(--t1)", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Generate a tailored outreach paragraph for this role — a warm first line you can send with your
                  application.
                </p>
                <button className="btn btn-primary" onClick={draft}>
                  <Sparkles size={15} />
                  Write my intro
                </button>
              </>
            )}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--t1)", fontSize: 13.5 }}>
                <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                Drafting a tailored intro…
              </div>
            )}
            {intro && !loading && (
              <>
                <div className="out">{intro}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn" onClick={copy}>
                    <Copy size={14} />
                    Copy
                  </button>
                  <button className="btn" onClick={draft}>
                    <RotateCcw size={14} />
                    Regenerate
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pfoot">
          <a
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: "center", textDecoration: "none" }}
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              // Applying requires sign-in — open the modal instead of leaving.
              if (!isSignedIn) {
                e.preventDefault();
                openSignIn();
              }
            }}
          >
            {isSignedIn ? `Apply on ${job.source}` : `Sign in to apply on ${job.source}`}
            <ArrowUpRight size={15} />
          </a>
          <button
            className="btn"
            onClick={() => onSave(job.id)}
            style={
              saved
                ? { color: "#ec4899", borderColor: "rgba(236,72,153,.35)", background: "rgba(236,72,153,.08)" }
                : {}
            }
          >
            <Heart size={15} fill={saved ? "#ec4899" : "none"} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
