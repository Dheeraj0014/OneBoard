/**
 * Prism brand mark. Also defines the shared `#pm` gradient used by
 * {@link MatchRing}; keep this mounted wherever the ring is rendered.
 */
export default function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="pm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset=".5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <path d="M6 22 L14.5 6.5 L23 22 Z" stroke="url(#pm)" strokeWidth="2" strokeLinejoin="round" />
      <line x1="1" y1="15" x2="8" y2="15" stroke="var(--t2)" strokeWidth="1.6" />
      <line x1="20.5" y1="13" x2="29" y2="10" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="20.5" y1="16" x2="29" y2="16" stroke="#8b5cf6" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="20.5" y1="19" x2="29" y2="22" stroke="#ec4899" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
