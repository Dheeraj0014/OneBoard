import { SlidersHorizontal, Heart, Sun, Moon } from "lucide-react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/react";
import Logo from "./Logo.jsx";

/** Sticky application header: brand, mobile filter trigger, saved & theme toggles. */
export default function TopBar({
  theme,
  onToggleTheme,
  view,
  onToggleSaved,
  savedCount,
  activeFilters,
  onOpenDrawer,
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <Logo />
          <h1>OneBoard</h1>
          <span className="tag">one lens for every job board</span>
        </div>
        <div className="topbar-actions">
          <button className="btn mfilter" aria-label="Filters" onClick={onOpenDrawer}>
            <SlidersHorizontal size={15} />
            {/* Label drops on phones so the row fits; the icon carries it. */}
            <span className="mfilter-text">Filters</span>
            {activeFilters > 0 && <span style={{ fontFamily: "var(--mono)" }}>· {activeFilters}</span>}
          </button>
          <button
            className="btn icon-btn"
            aria-label="Saved roles"
            onClick={onToggleSaved}
            style={view === "saved" ? { color: "#ec4899", borderColor: "rgba(236,72,153,.35)" } : {}}
          >
            <Heart size={17} fill={savedCount ? "#ec4899" : "none"} />
            {savedCount > 0 && <span className="count-dot">{savedCount}</span>}
          </button>
          <button className="btn icon-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="btn">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn btn-primary">Sign up</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton afterSignOutUrl="/" />
          </Show>
        </div>
      </div>
    </header>
  );
}
