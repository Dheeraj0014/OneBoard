import { Linkedin } from "lucide-react";

/**
 * The X brand mark. lucide's `X` is the close/cross glyph, not the logo, so the
 * wordmark is drawn here. Filled rather than stroked, which is how the glyph is
 * defined — it still reads correctly beside the outline icons at this size.
 */
function XMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIALS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/dheeraj-darekar/",
    icon: <Linkedin size={16} />,
  },
  {
    label: "X",
    href: "https://x.com/dheeraj_darekar",
    icon: <XMark size={15} />,
  },
];

/** Site footer: brand line, attribution, and social links. */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-mark">OneBoard</span>
          <span className="footer-tag">one lens for every job board</span>
        </div>

        <div className="footer-right">
          <span className="footer-by">
            Built by <span className="footer-name">Dheeraj Darekar</span>
          </span>
          <div className="footer-socials">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                className="footer-social"
                href={s.href}
                target="_blank"
                // noopener/noreferrer: without it the opened tab gets a handle on
                // this one via window.opener and could navigate it away.
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="footer-legal">
        © {new Date().getFullYear()} OneBoard · Listings belong to their respective employers.
      </div>
    </footer>
  );
}
