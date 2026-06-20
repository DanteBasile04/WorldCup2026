const HYPHEN_PATTERN = /[\u2010-\u2015\u2212\u2043\uFE58\uFE63\uFF0D-]+/g;
const APOSTROPHE_PATTERN = /[`´‘’ʼ＇']+/g;

export function normalizePlayerNameForMatching(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(HYPHEN_PATTERN, "-")
    .replace(APOSTROPHE_PATTERN, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9-]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toCompactPlayerNameKey(value) {
  return normalizePlayerNameForMatching(value).replace(/\s+/g, "");
}

export function tokenizePlayerName(value) {
  return normalizePlayerNameForMatching(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}
