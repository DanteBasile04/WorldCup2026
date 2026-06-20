#!/usr/bin/env node

/**
 * Local formation preview tool — generates a standalone HTML page
 * for visually inspecting a formation SVG before exporting.
 *
 * THIS IS A PRIVATE LOCAL TOOL. Do not expose as a public route, server
 * action, or visible UI component.
 *
 * Input formats (same as upload-formation.mjs):
 *
 *   1. JSON file (like samples/country-formation-mexico-input.json):
 *      node scripts/preview-formation.mjs --input samples/country-formation-mexico-input.json
 *
 *   2. Text authoring format (--text or --stdin):
 *      node scripts/preview-formation.mjs --text "argentina 4-3-3
 *            1 Martinez GK
 *            4 | Gonzalo Montiel | DF | Montiel | LB
 *            ..."
 *
 *      echo "argentina 4-3-3
 *            1 Martinez GK" | node scripts/preview-formation.mjs --stdin
 *
 *   3. Command-line arguments:
 *      node scripts/preview-formation.mjs --slug argentina --formation "4-3-3" \
 *            --players "1,Martinez,GK;4,Gonzalo Montiel,DF,Montiel,LB;..."
 *
 * Output:
 *   --output <path>   Write HTML to file (default: generated/preview-formation.html)
 *   --stdout           Write HTML to stdout instead of a file
 *   --open             Open the generated file in the default browser
 *
 * Examples:
 *   pnpm formation:preview --input samples/country-formation-mexico-input.json
 *   pnpm formation:preview --input samples/country-formation-mexico-input.json --open
 *   pnpm formation:preview --text "mexico 4-1-2-3\n1 Raul RANGEL GK\n23 | Jesus GALLARDO | DF | Gallardo | LB\n5 | Johan VASQUEZ | DF | Vasquez | LCB\n3 | Cesar MONTES | DF | Montes | RCB\n15 | Israel REYES | DF | Reyes | RB\n6 | Erik LIRA | MF | Lira | DM\n8 | Alvaro FIDALGO | MF | Fidalgo | LCM\n26 | Brian GUTIERREZ | MF | Gutierrez | RCM\n25 | Roberto ALVARADO | FW | Alvarado | LW\n9 | Raul JIMENEZ | FW | Jimenez | ST\n16 | Julian QUINONES | FW | Quinones | RW"
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { parseFormationAuthoringText, parseFormationPlayersArgument } from "./lib/formation-authoring.mjs";
import { createCountryFormationUpdate } from "./lib/formation-svg.mjs";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);

function getOptionValue(args, optionName) {
  const directMatch = args.find((value) => value.startsWith(`${optionName}=`));
  if (directMatch) return directMatch.slice(optionName.length + 1).trim();

  const index = args.indexOf(optionName);
  if (index === -1) return null;

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}.`);
  }

  return value;
}

const args = new Set(argv);
const inputPath = getOptionValue(argv, "--input");
const textInput = getOptionValue(argv, "--text");
const slugArg = getOptionValue(argv, "--slug");
const formationArg = getOptionValue(argv, "--formation");
const playersArg = getOptionValue(argv, "--players");
const outputPath = getOptionValue(argv, "--output");
const printStdout = args.has("--stdout");
const openBrowser = args.has("--open");
const stdinMode = args.has("--stdin");

// ---------------------------------------------------------------------------
// Input resolution (shared pattern with upload-formation.mjs)
// ---------------------------------------------------------------------------

function resolveFormationInput() {
  // Priority 1: JSON file input
  if (inputPath) {
    const resolvedPath = resolve(process.cwd(), inputPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Input file not found: ${resolvedPath}`);
    }
    const raw = readFileSync(resolvedPath, "utf8");
    return JSON.parse(raw);
  }

  // Priority 2: --text authoring format
  if (textInput) {
    return parseCompactText(textInput);
  }

  // Priority 3: --slug + --formation + --players
  if (slugArg && formationArg && playersArg) {
    return parseCliArgs(slugArg, formationArg, playersArg);
  }

  // Priority 4: stdin
  if (stdinMode) {
    return readStdinSync();
  }

  throw new Error(
    "No input provided. Use --input <file.json>, --text <authoring-text>, --slug/--formation/--players, or --stdin.",
  );
}

/**
 * Parse text authoring format.
 */
function parseCompactText(text) {
  return parseFormationAuthoringText(text);
}

/**
 * Parse CLI arguments: --slug, --formation, --players
 * Players format: "1,Martinez,GK;4,Gonzalo Montiel,DF,Montiel,LB;..."
 */
function parseCliArgs(slug, formation, playersStr) {
  const players = parseFormationPlayersArgument(playersStr);

  return {
    country: { slug },
    team: { formation },
    players,
  };
}

/**
 * Read stdin synchronously (for piped input).
 */
function readStdinSync() {
  try {
    const buffer = readFileSync(0, "utf8");
    return parseCompactText(buffer);
  } catch {
    throw new Error(
      "Could not read from stdin. Use --input <file> or --text <authoring-text> instead.",
    );
  }
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe inclusion inside a JS template literal or HTML attribute.
 */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Escape a string for safe inclusion inside a JS template literal.
 */
function escapeJs(str) {
  return String(str)
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("$", "\\$");
}

function generatePreviewHtml(payload) {
  const { document, formationSvg, country } = payload;
  const teamName = escapeHtml(document.team.name);
  const formation = escapeHtml(document.team.formation);
  const playerCount = document.players.length;
  const countrySlug = escapeHtml(country.slug ?? country.name ?? "unknown");

  const playerRows = document.players
    .map(
      (p) =>
        `<tr>
          <td>${escapeHtml(String(p.number))}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.role)}</td>
          <td>${escapeHtml(p.label)}</td>
          <td>${escapeHtml(p.slot)}</td>
        </tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Formation Preview — ${teamName} (${formation})</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #1a1a1a;
      --bg-card: #141414;
      --text-primary: #f5f5f5;
      --text-secondary: #a3a3a3;
      --accent: #2dd4bf;
      --accent-muted: #115e59;
      --border: #262626;
      --success: #22c55e;
      --warning: #f59e0b;
    }

    .preview-light {
      --bg-primary: #fafafa;
      --bg-secondary: #f5f5f5;
      --bg-card: #ffffff;
      --text-primary: #171717;
      --text-secondary: #525252;
      --accent: #0d9488;
      --accent-muted: #99f6e4;
      --border: #d4d4d4;
      --success: #16a34a;
      --warning: #d97706;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
      min-height: 100vh;
    }

    header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg-secondary);
    }

    header h1 {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    header h1 span.formation-tag {
      color: var(--accent);
      margin-left: 0.5rem;
    }

    .meta {
      margin-top: 0.25rem;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg-secondary);
    }

    .controls button {
      font-family: inherit;
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text-primary);
      cursor: pointer;
      transition: background 150ms, border-color 150ms;
    }

    .controls button:hover {
      background: var(--accent-muted);
      border-color: var(--accent);
    }

    .controls button.active {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
      font-weight: 600;
    }

    .controls .spacer {
      flex: 1;
    }

    .controls button.export-btn {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
      font-weight: 600;
    }

    .controls button.export-btn:hover {
      opacity: 0.85;
    }

    .preview-area {
      flex: 1;
      overflow: hidden;
      position: relative;
      background: var(--bg-primary);
    }

    .preview-area svg {
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
    }

    .preview-area svg:active {
      cursor: grabbing;
    }

    .bottom-panel {
      border-top: 1px solid var(--border);
      background: var(--bg-secondary);
      max-height: 260px;
      overflow-y: auto;
    }

    .confirmation {
      padding: 1rem 1.5rem;
    }

    .confirmation h2 {
      font-size: 0.9375rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--accent);
    }

    .confirmation-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.5rem;
    }

    .confirmation-grid dt {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }

    .confirmation-grid dd {
      font-size: 0.9375rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .player-table-wrapper {
      padding: 0 1.5rem 1rem;
    }

    .player-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .player-table th {
      text-align: left;
      padding: 0.375rem 0.5rem;
      border-bottom: 1px solid var(--border);
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .player-table td {
      padding: 0.375rem 0.5rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-primary);
    }

    .toast {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      padding: 0.625rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      z-index: 1000;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 200ms, transform 200ms;
      pointer-events: none;
    }

    .toast.visible {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .toast.success {
      background: var(--success);
      color: #000;
    }

    .toast.error {
      background: #ef4444;
      color: #fff;
    }

    .zoom-hint {
      position: absolute;
      bottom: 0.75rem;
      left: 0.75rem;
      font-size: 0.6875rem;
      color: var(--text-secondary);
      pointer-events: none;
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <header>
    <h1>${teamName} <span class="formation-tag">${formation}</span></h1>
    <div class="meta">
      ${playerCount} players &middot; Country: ${countrySlug}
    </div>
  </header>

  <div class="controls">
    <button id="toggleLabels" class="active" title="Toggle player name labels on/off">Labels: ON</button>
    <button id="toggleNumbers" class="active" title="Toggle player numbers on/off">Numbers: ON</button>
    <button id="toggleBackground" title="Switch between dark and light pitch theme">Light BG</button>
    <button id="resetZoom" title="Reset zoom and pan to default">Reset View</button>
    <div class="spacer"></div>
    <button id="copySvg" class="export-btn" title="Copy formation SVG to clipboard">Copy SVG</button>
    <button id="saveSvg" class="export-btn" title="Download formation SVG as file">Save SVG</button>
  </div>

  <div class="preview-area" id="previewArea">
    ${formationSvg}
    <div class="zoom-hint">Scroll to zoom &middot; Drag to pan</div>
  </div>

  <div class="bottom-panel">
    <section class="confirmation">
      <h2>Formation Confirmation</h2>
      <dl class="confirmation-grid">
        <div>
          <dt>Team</dt>
          <dd>${teamName}</dd>
        </div>
        <div>
          <dt>Formation</dt>
          <dd>${formation}</dd>
        </div>
        <div>
          <dt>Players</dt>
          <dd>${playerCount}</dd>
        </div>
        <div>
          <dt>SVG Size</dt>
          <dd>${formationSvg.length.toLocaleString()} chars</dd>
        </div>
      </dl>
    </section>
    <div class="player-table-wrapper">
      <table class="player-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Role</th>
            <th>Label</th>
            <th>Slot</th>
          </tr>
        </thead>
        <tbody>
          ${playerRows}
        </tbody>
      </table>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    (function () {
      "use strict";

      var previewArea = document.getElementById("previewArea");
      var svg = previewArea.querySelector("svg");
      var toast = document.getElementById("toast");

      // --- State ---
      var state = {
        labelsVisible: true,
        numbersVisible: true,
        lightBg: false,
        zoom: 1,
        panX: 0,
        panY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        startPanX: 0,
        startPanY: 0,
      };

      // --- SVG reference for export ---
      var svgSource = \`${escapeJs(formationSvg)}\`;

      // --- Zoom / Pan ---
      function applyTransform() {
        svg.style.transformOrigin = "0 0";
        svg.style.transform = "translate(" + state.panX + "px," + state.panY + "px) scale(" + state.zoom + ")";
        svg.style.width = "";
        svg.style.height = "";
      }

      previewArea.addEventListener("wheel", function (e) {
        e.preventDefault();
        var delta = e.deltaY > 0 ? 0.9 : 1.1;
        var newZoom = state.zoom * delta;
        if (newZoom < 0.2) newZoom = 0.2;
        if (newZoom > 8) newZoom = 8;

        var rect = previewArea.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        var mouseY = e.clientY - rect.top;

        state.panX = mouseX - (mouseX - state.panX) * (newZoom / state.zoom);
        state.panY = mouseY - (mouseY - state.panY) * (newZoom / state.zoom);
        state.zoom = newZoom;
        applyTransform();
      }, { passive: false });

      previewArea.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        state.isDragging = true;
        state.dragStartX = e.clientX;
        state.dragStartY = e.clientY;
        state.startPanX = state.panX;
        state.startPanY = state.panY;
      });

      window.addEventListener("mousemove", function (e) {
        if (!state.isDragging) return;
        state.panX = state.startPanX + (e.clientX - state.dragStartX);
        state.panY = state.startPanY + (e.clientY - state.dragStartY);
        applyTransform();
      });

      window.addEventListener("mouseup", function () {
        state.isDragging = false;
      });

      // --- Toggle: Labels ---
      document.getElementById("toggleLabels").addEventListener("click", function () {
        state.labelsVisible = !state.labelsVisible;
        this.textContent = "Labels: " + (state.labelsVisible ? "ON" : "OFF");
        this.classList.toggle("active", state.labelsVisible);
        updateLabelVisibility();
      });

      // --- Toggle: Numbers ---
      document.getElementById("toggleNumbers").addEventListener("click", function () {
        state.numbersVisible = !state.numbersVisible;
        this.textContent = "Numbers: " + (state.numbersVisible ? "ON" : "OFF");
        this.classList.toggle("active", state.numbersVisible);
        updateNumberVisibility();
      });

      function updateLabelVisibility() {
        var groups = svg.querySelectorAll("g");
        groups.forEach(function (g) {
          var texts = g.querySelectorAll("text");
          // Second text = player name label
          if (texts.length >= 2) {
            texts[1].style.visibility = state.labelsVisible ? "visible" : "hidden";
          }
        });
      }

      function updateNumberVisibility() {
        var groups = svg.querySelectorAll("g");
        groups.forEach(function (g) {
          var texts = g.querySelectorAll("text");
          // First text = player number
          if (texts.length >= 1) {
            texts[0].style.visibility = state.numbersVisible ? "visible" : "hidden";
          }
        });
      }

      // --- Toggle: Background ---
      document.getElementById("toggleBackground").addEventListener("click", function () {
        state.lightBg = !state.lightBg;
        this.textContent = state.lightBg ? "Dark BG" : "Light BG";
        document.body.classList.toggle("preview-light", state.lightBg);

        // Swap the SVG pitch background colors
        var rects = svg.querySelectorAll("rect");
        rects.forEach(function (rect) {
          var currentFill = rect.getAttribute("fill");
          if (currentFill === "#052e16") {
            rect.setAttribute("fill", "#e8f5e9");
          } else if (currentFill === "#e8f5e9") {
            rect.setAttribute("fill", "#052e16");
          } else if (currentFill === "#166534") {
            rect.setAttribute("fill", "#81c784");
          } else if (currentFill === "#81c784") {
            rect.setAttribute("fill", "#166534");
          }
        });

        // Swap pitch line colors
        var lines = svg.querySelectorAll("line, circle[fill='#dcfce7'], circle[stroke='#dcfce7']");
        lines.forEach(function (el) {
          var stroke = el.getAttribute("stroke");
          if (stroke === "#dcfce7") {
            el.setAttribute("stroke", "#1b5e20");
          } else if (stroke === "#1b5e20") {
            el.setAttribute("stroke", "#dcfce7");
          }
        });

        // Swap center circle fill
        var circles = svg.querySelectorAll("circle");
        circles.forEach(function (c) {
          var fill = c.getAttribute("fill");
          if (fill === "#dcfce7") {
            c.setAttribute("fill", "#1b5e20");
          } else if (fill === "#1b5e20") {
            c.setAttribute("fill", "#dcfce7");
          }
          var stroke = c.getAttribute("stroke");
          if (stroke === "#dcfce7") {
            c.setAttribute("stroke", "#1b5e20");
          }
        });
      });

      // --- Reset zoom ---
      document.getElementById("resetZoom").addEventListener("click", function () {
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;
        applyTransform();
      });

      // --- Copy SVG ---
      document.getElementById("copySvg").addEventListener("click", function () {
        // Use the original SVG source, not the transformed one
        navigator.clipboard.writeText(svgSource).then(function () {
          showToast("SVG copied to clipboard", "success");
        }).catch(function () {
          // Fallback for older browsers
          var ta = document.createElement("textarea");
          ta.value = svgSource;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          showToast("SVG copied to clipboard", "success");
        });
      });

      // --- Save SVG ---
      document.getElementById("saveSvg").addEventListener("click", function () {
        var blob = new Blob([svgSource], { type: "image/svg+xml" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "formation-${escapeJs(countrySlug)}-${escapeJs(formation)}.svg";
        a.click();
        URL.revokeObjectURL(url);
        showToast("SVG file download started", "success");
      });

      // --- Toast ---
      function showToast(message, type) {
        toast.textContent = message;
        toast.className = "toast " + type + " visible";
        setTimeout(function () {
          toast.classList.remove("visible");
        }, 2500);
      }

      // --- Initial size ---
      svg.style.maxWidth = "100%";
      svg.style.height = "auto";
      svg.style.display = "block";
      svg.style.margin = "0 auto";
    })();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

try {
  const formationInput = resolveFormationInput();
  const payload = createCountryFormationUpdate(formationInput);

  console.log(`Formation: ${payload.document.team.formation}`);
  console.log(`Team: ${payload.document.team.name}`);
  console.log(`Players: ${payload.document.players.length}`);
  console.log(`SVG: ${payload.formationSvg.length} chars`);

  const html = generatePreviewHtml(payload);

  if (printStdout) {
    process.stdout.write(html);
  } else {
    const outputFilePath = outputPath
      ? resolve(process.cwd(), outputPath)
      : resolve(process.cwd(), "generated/preview-formation.html");

    const outputDir = dirname(outputFilePath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    writeFileSync(outputFilePath, html, "utf8");
    console.log(`\nPreview written to: ${outputFilePath}`);

    if (openBrowser) {
      try {
        if (process.platform === "win32") {
          execFileSync("cmd", ["/c", "start", "", outputFilePath], { stdio: "ignore" });
        } else if (process.platform === "darwin") {
          execFileSync("open", [outputFilePath], { stdio: "ignore" });
        } else {
          execFileSync("xdg-open", [outputFilePath], { stdio: "ignore" });
        }
        console.log("Opened in default browser.");
      } catch {
        console.log(`Could not open browser automatically. Open manually: ${outputFilePath}`);
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
