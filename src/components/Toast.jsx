import { Check } from "lucide-react";

/** Small transient notification pinned to the bottom of the screen. */
export default function Toast({ message }) {
  return (
    <div className="toast">
      <Check size={15} style={{ color: "var(--good)" }} />
      {message}
    </div>
  );
}
