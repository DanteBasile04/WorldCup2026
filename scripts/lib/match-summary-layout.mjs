export const LAYOUT_VERSION = "match-summary-v1";

const PANEL_SPLITS = {
  left: { start: 0, end: 0.325 },
  center: { start: 0.325, end: 0.675 },
  right: { start: 0.675, end: 1 },
};

export function getMatchSummaryZones(width, height) {
  const safeWidth = toPositiveInteger(width, "width");
  const safeHeight = toPositiveInteger(height, "height");

  return {
    layoutVersion: LAYOUT_VERSION,
    left: buildZone(PANEL_SPLITS.left, safeWidth, safeHeight),
    center: buildZone(PANEL_SPLITS.center, safeWidth, safeHeight),
    right: buildZone(PANEL_SPLITS.right, safeWidth, safeHeight),
  };
}

function buildZone(split, width, height) {
  const x = Math.round(width * split.start);
  const rightEdge = Math.round(width * split.end);

  return {
    x,
    y: 0,
    width: Math.max(rightEdge - x, 1),
    height,
  };
}

function toPositiveInteger(value, label) {
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive ${label}, received "${value}".`);
  }

  return parsed;
}
