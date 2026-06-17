const WORLD_CUP_PAGE = "2026_FIFA_World_Cup";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const EXPECTED_FEDERATIONS = new Set([
  "AFC",
  "CAF",
  "CONCACAF",
  "CONMEBOL",
  "OFC",
  "UEFA",
]);

export async function getQualifiedTeams() {
  const sectionIndex = await getQualificationSectionIndex();
  const html = await fetchWikipediaHtml(WORLD_CUP_PAGE, sectionIndex);
  const table = extractQualifiedTeamsTable(html);
  const teams = parseQualifiedTeams(table);

  if (teams.length === 0) {
    throw new Error("No qualified teams were parsed from Wikipedia.");
  }

  return teams;
}

export async function fetchWikipediaHtml(page, section) {
  const url = new URL(WIKIPEDIA_API);
  url.search = new URLSearchParams({
    action: "parse",
    page,
    section: String(section),
    prop: "text",
    format: "json",
    origin: "*",
  }).toString();

  const json = await fetchJson(url);
  return json.parse.text["*"];
}

export async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "wc26-country-importer/1.0 (one-time setup script)",
    },
  });

  if (!response.ok) {
    if (response.status === 429 && attempt <= 3) {
      const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "5", 10);
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 5000);
      return fetchJson(url, attempt + 1);
    }

    throw new Error(`Wikipedia request failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    if (/too many requests/i.test(text) && attempt <= 3) {
      await sleep(5000);
      return fetchJson(url, attempt + 1);
    }

    throw new Error(`Wikipedia returned a non-JSON response: ${text.slice(0, 120)}`);
  }
}

export function chunk(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export function getOptionValue(argv, optionName) {
  const directMatch = argv.find((value) => value.startsWith(`${optionName}=`));

  if (directMatch) {
    return directMatch.slice(optionName.length + 1).trim();
  }

  const index = argv.indexOf(optionName);

  if (index === -1) return null;

  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

export function normalizeName(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function slugifyName(value) {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stripTags(value) {
  return value.replace(/<[^>]*>/g, "");
}

export function decodeHtml(value) {
  return value
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(
        code.startsWith("x") || code.startsWith("X")
          ? Number.parseInt(code.slice(1), 16)
          : Number.parseInt(code, 10),
      ),
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractQualifiedTeamsTable(html) {
  const start = html.indexOf('<table class="col-begin"');

  if (start === -1) {
    throw new Error("Could not find the qualified teams table on Wikipedia.");
  }

  const end = html.indexOf("</table>", start);

  if (end === -1) {
    throw new Error("Could not find the end of the qualified teams table on Wikipedia.");
  }

  return html.slice(start, end + "</table>".length);
}

function parseQualifiedTeams(tableHtml) {
  const teams = [];
  const federationBlocks = tableHtml.matchAll(
    /<p><b><a[^>]*>(AFC|CAF|CONCACAF|CONMEBOL|OFC|UEFA)<\/a><\/b>[\s\S]*?<\/p>\s*<ul>([\s\S]*?)<\/ul>/g,
  );

  for (const [, federation, listHtml] of federationBlocks) {
    for (const [, itemHtml] of listHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const flagUrl = toOriginalWikimediaUrl(matchAttribute(itemHtml, "img", "src"));
      const teamLink = itemHtml.match(
        /<a\s+href="([^"]+)"\s+title="([^"]*(?:football|soccer) team[^"]*)">([\s\S]*?)<\/a>/i,
      );

      if (!teamLink) continue;

      const [, href, title, rawName] = teamLink;
      const name = decodeHtml(stripTags(rawName)).trim();

      if (!name || !EXPECTED_FEDERATIONS.has(federation)) continue;

      teams.push({
        name,
        federation,
        flag_url: flagUrl,
        emblem_url: null,
        team_page: `https://en.wikipedia.org${decodeHtml(href)}`,
        wikipedia_title: decodeHtml(title),
      });
    }
  }

  return dedupeByName(teams);
}

async function getQualificationSectionIndex() {
  const url = new URL(WIKIPEDIA_API);
  url.search = new URLSearchParams({
    action: "parse",
    page: WORLD_CUP_PAGE,
    prop: "sections",
    format: "json",
    origin: "*",
  }).toString();

  const json = await fetchJson(url);
  const section = json.parse.sections.find((item) => item.line === "Qualification");

  if (!section?.index) {
    throw new Error("Could not locate the Qualification section on Wikipedia.");
  }

  return section.index;
}

function matchAttribute(html, tag, attribute) {
  const match = html.match(new RegExp(`<${tag}[^>]+${attribute}="([^"]+)"`, "i"));
  return match?.[1] ?? null;
}

function dedupeByName(teams) {
  const byName = new Map();

  for (const team of teams) {
    byName.set(normalizeName(team.name), team);
  }

  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name, "en"));
}

function toOriginalWikimediaUrl(src) {
  if (!src) return null;

  const absoluteUrl = decodeHtml(src).startsWith("//") ? `https:${decodeHtml(src)}` : decodeHtml(src);
  const withoutThumb = absoluteUrl.replace(
    /\/wikipedia\/([^/]+)\/thumb\/([^/]+)\/([^/]+)\/[^/]+$/,
    "/wikipedia/$1/$2/$3",
  );

  return withoutThumb.replace(/ /g, "_");
}
