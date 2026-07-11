import { FileText, X } from "lucide-react";

/**
 * The second chance for people who skipped onboarding: a quiet, dismissible
 * invite to add a resume. Deliberately low-key — they already said no once.
 */
export default function ResumePrompt({ onOpen, onDismiss }) {
  return (
    <div className="rprompt">
      <div className="ic">
        <FileText size={15} />
      </div>
      <div className="txt">
        <b>Add your resume</b> to score every role against your experience.
      </div>
      <button className="btn rprompt-cta" onClick={onOpen}>
        Add resume
      </button>
      <button
        className="icon-btn"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ flex: "none", width: 32, height: 32 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
