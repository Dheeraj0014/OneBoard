import { useState, useEffect } from "react";

/**
 * Animated circular progress ring showing an AI match score (0-100).
 * Relies on the `#pm` gradient defined by {@link Logo}.
 */
export default function MatchRing({ score, size = 48 }) {
  const [draw, setDraw] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDraw(true), 70);
    return () => clearTimeout(t);
  }, []);

  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="3.5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#pm)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={draw ? off : c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-arc"
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="ring-num"
        style={{ fontSize: size * 0.28 }}
      >
        {score}
      </text>
    </svg>
  );
}
