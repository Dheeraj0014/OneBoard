import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, Sparkles, Loader2, AlertTriangle, Check } from "lucide-react";
import { parseResumePdf } from "../services/profile.js";
import { LEVELS, REMOTES } from "../data/constants.js";

/** Skill chips offered when the live feed hasn't produced enough facets yet. */
const FALLBACK_SKILLS = [
  "React", "TypeScript", "Node.js", "Python", "Java", "Go",
  "AWS", "Kubernetes", "SQL", "GraphQL", "Docker", "Machine Learning",
];

/** Toggle a value's membership in an array (immutably). */
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * First-visit resume + preferences capture. Submitting produces the profile
 * every job then gets scored against; skipping leaves the plain catalog.
 *
 * Accepts a PDF (parsed to text server-side) or pasted text — both land in the
 * same `resumeText`, so the rest of the pipeline never cares which was used.
 */
export default function ResumeModal({ onSubmit, onSkip, onClose, allSkills = [], profile = null }) {
  const prefs = profile?.prefs || {};

  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [roles, setRoles] = useState(prefs.roles || "");
  const [skills, setSkills] = useState(prefs.skills || []);
  const [remote, setRemote] = useState(prefs.remote || []);
  const [level, setLevel] = useState(prefs.level || []);

  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef(null);

  // Suggest the skills that actually appear in the live feed — a chip for a
  // skill no listing mentions is a dead end. Top up from a static list when the
  // feed is thin (e.g. first paint, before jobs land).
  const chips = [...new Set([...allSkills.slice(0, 14), ...FALLBACK_SKILLS])].slice(0, 16);

  const readFile = useCallback(async (file) => {
    if (!file) return;
    setError("");
    setParsing(true);
    try {
      const text = await parseResumePdf(file);
      setResumeText(text);
      setFileName(file.name);
    } catch (err) {
      setError(err.message);
      setFileName("");
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    readFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async () => {
    const text = resumeText.trim();
    if (text.length < 40) {
      setError("Add your resume — a PDF, or at least a couple of lines of text.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(text, {
        roles: roles.trim(),
        skills,
        remote,
        level,
      });
      // Parent closes the modal on success.
    } catch (err) {
      setError(err.message || "Couldn't read that resume. Try again.");
      setSubmitting(false);
    }
  };

  const busy = parsing || submitting;

  return (
    <>
      <div className="overlay" onClick={busy ? undefined : onClose} />
      <div className="rm" role="dialog" aria-modal="true" aria-labelledby="rm-title">
        <button className="rm-x" onClick={onClose} aria-label="Close" disabled={busy}>
          <X size={16} />
        </button>

        <div className="rm-head">
          <div className="rm-ic">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 id="rm-title">{profile ? "Update your match profile" : "Let's tailor your feed"}</h2>
            <p>
              Add your resume and what you're after. Every role gets scored against it, best fit
              first.
            </p>
          </div>
        </div>

        <div className="rm-body">
          <label className="rm-label">Your resume</label>

          <div
            className={`dropzone${dragging ? " on" : ""}${fileName ? " done" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !busy && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          >
            {parsing ? (
              <>
                <Loader2 size={20} className="spin" />
                <span className="dz-1">Reading your resume…</span>
              </>
            ) : fileName ? (
              <>
                <Check size={20} style={{ color: "#34d399" }} />
                <span className="dz-1">{fileName}</span>
                <span className="dz-2">Parsed · click to replace</span>
              </>
            ) : (
              <>
                <Upload size={20} />
                <span className="dz-1">Drop your resume PDF</span>
                <span className="dz-2">or click to browse</span>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              readFile(e.target.files?.[0]);
              e.target.value = ""; // let the same file be re-picked after an error
            }}
          />

          <div className="rm-or">
            <span>or paste it instead</span>
          </div>

          <textarea
            className="rm-ta"
            rows={4}
            placeholder="Senior frontend engineer, 6 years. React, TypeScript, Node. Built design systems at two fintech startups…"
            value={fileName ? "" : resumeText}
            onChange={(e) => {
              setResumeText(e.target.value);
              setFileName("");
            }}
            disabled={busy || Boolean(fileName)}
          />
          {fileName && (
            <button
              className="rm-clear"
              onClick={() => {
                setFileName("");
                setResumeText("");
              }}
            >
              <FileText size={12} />
              Clear the PDF to paste text instead
            </button>
          )}

          <div className="rm-sep" />

          <label className="rm-label" htmlFor="rm-roles">
            What are you looking for? <span className="rm-opt">optional</span>
          </label>
          <input
            id="rm-roles"
            className="rm-in"
            placeholder="e.g. senior frontend roles at product companies"
            value={roles}
            onChange={(e) => setRoles(e.target.value)}
            disabled={busy}
          />

          <label className="rm-label">
            Skills you want to use <span className="rm-opt">optional</span>
          </label>
          <div className="rm-chips">
            {chips.map((s) => (
              <button
                key={s}
                className={`rm-chip${skills.includes(s) ? " on" : ""}`}
                onClick={() => setSkills((v) => toggle(v, s))}
                disabled={busy}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="rm-row">
            <div>
              <label className="rm-label">
                Workplace <span className="rm-opt">optional</span>
              </label>
              <div className="rm-chips">
                {REMOTES.map((r) => (
                  <button
                    key={r}
                    className={`rm-chip${remote.includes(r) ? " on" : ""}`}
                    onClick={() => setRemote((v) => toggle(v, r))}
                    disabled={busy}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="rm-label">
                Seniority <span className="rm-opt">optional</span>
              </label>
              <div className="rm-chips">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    className={`rm-chip${level.includes(l) ? " on" : ""}`}
                    onClick={() => setLevel((v) => toggle(v, l))}
                    disabled={busy}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="rm-err">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="rm-foot">
          <button className="rm-skip" onClick={onSkip} disabled={busy}>
            Skip for now
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={busy}>
            {submitting ? (
              <>
                <Loader2 size={14} className="spin" />
                Matching…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Match my jobs
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
