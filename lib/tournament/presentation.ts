// ---------------------------------------------------------------------------
// Tournament presentation helpers — fallback labels, score formatting,
// density flags, and safe team-color parsing with contrast checks.
// Codifies the designMd visual-system rules into testable helpers.
// ---------------------------------------------------------------------------

// -- Fallback labels (stable placeholder contract) -------------------------

export const FALLBACK = {
  teamName: "TBD team",
  score: "Score TBD",
  venue: "Venue TBD",
  status: "Status TBD",
  round: "Round TBD",
} as const;

// -- Score formatting ------------------------------------------------------

export function formatScore(
  local: number | null,
  away: number | null,
): string {
  if (local === null || away === null) {
    return FALLBACK.score;
  }
  return `${local}\u2013${away}`;
}

// -- Density flags ---------------------------------------------------------

export type TournamentDensity = "comfortable" | "compact";

export type TournamentTheme = {
  surface: "obsidian" | "glass";
  accent: "crimson" | "gold";
  radius: "soft";
  density: TournamentDensity;
};

export const DENSITY_FLAGS: Record<
  TournamentDensity,
  { cellPadding: string; fontSize: string; lineHeight: string }
> = {
  comfortable: {
    cellPadding: "0.75rem",
    fontSize: "0.875rem",
    lineHeight: "1.5",
  },
  compact: {
    cellPadding: "0.375rem",
    fontSize: "0.75rem",
    lineHeight: "1.25",
  },
};

// -- Safe team-color parser with contrast check ----------------------------

export type TeamPalette = {
  accent: string;
  accentMuted: string;
  useOn: "badge" | "border" | "hero";
  isNeutral: boolean;
};

/** Allowed color format: 3- or 6-digit hex */
const SAFE_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Minimum contrast ratio against the obsidian background (WCAG AA large) */
const MIN_CONTRAST_RATIO = 3;

/** Obsidian background for luminance comparison */
const OBSIDIAN_BG = "#060610";

/** Relative luminance per WCAG 2.1 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Contrast ratio between two luminances */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Convert hex string to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (full.length !== 6) return null;
  const n = parseInt(full, 16);
  if (isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Parse a `Country.colors` value into a contrast-safe `TeamPalette`.
 *
 * The raw `colors` field is `string | null` and may be JSON (array or
 * string), comma-separated hex values, or a single hex. Only hex colors
 * that pass the format whitelist AND meet the minimum contrast ratio
 * against the obsidian background are accepted. Falls back to the
 * global crimson accent otherwise.
 */
export function parseTeamColors(
  raw: string | null,
  useOn: TeamPalette["useOn"] = "badge",
): TeamPalette {
  const neutral: TeamPalette = {
    accent: "var(--accent-crimson)",
    accentMuted: "rgba(196, 30, 58, 0.3)",
    useOn,
    isNeutral: true,
  };

  if (!raw) return neutral;

  let candidates: string[] = [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      candidates = parsed.filter((v): v is string => typeof v === "string");
    } else if (typeof parsed === "string") {
      candidates = [parsed];
    }
  } catch {
    candidates = raw.split(",").map((s) => s.trim());
  }

  const bgRgb = hexToRgb(OBSIDIAN_BG);
  if (!bgRgb) return neutral;
  const bgLuminance = relativeLuminance(...bgRgb);

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!SAFE_COLOR_RE.test(trimmed)) continue;

    const rgb = hexToRgb(trimmed);
    if (!rgb) continue;

    const fgLuminance = relativeLuminance(...rgb);
    const ratio = contrastRatio(fgLuminance, bgLuminance);

    if (ratio >= MIN_CONTRAST_RATIO) {
      return {
        accent: trimmed,
        accentMuted: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`,
        useOn,
        isNeutral: false,
      };
    }
  }

  return neutral;
}
