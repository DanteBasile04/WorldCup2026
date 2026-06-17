// ---------------------------------------------------------------------------
// Tab bar — server-rendered Groups/Knockout links with gold active underline.
// Uses query-string ?view=groups|knockout to switch views without client JS.
// ---------------------------------------------------------------------------

import Link from "next/link";

type TabBarProps = {
  activeView: "groups" | "knockout";
};

const TABS = [
  { key: "groups" as const, label: "Groups" },
  { key: "knockout" as const, label: "Knockout" },
];

export function TabBar({ activeView }: TabBarProps) {
  return (
    <nav className="flex gap-1 border-b border-white/10" role="tablist">
      {TABS.map((tab) => {
        const isActive = activeView === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/?view=${tab.key}`}
            role="tab"
            aria-selected={isActive}
            className={[
              "relative px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors",
              isActive
                ? "text-[var(--accent-gold)]"
                : "text-slate-400 hover:text-white",
            ].join(" ")}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-gold)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
