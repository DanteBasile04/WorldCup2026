import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { getMatchSummaryZones, LAYOUT_VERSION } from "./match-summary-layout.mjs";

const DEFAULT_PROVIDER = "auto";
const LIVE_OCR_PROVIDER = "tesseract";
const TESSERACT_CACHE_PATH = resolve(process.cwd(), ".cache", "tesseract");
const SUPPORTED_PROVIDERS = new Set([DEFAULT_PROVIDER, "fixture", LIVE_OCR_PROVIDER, "tesseract.js"]);
const OCR_ZONE_NAMES = ["left", "center", "right"];
const ZONE_HORIZONTAL_OVERLAP_RATIO = 0.03;
const CENTER_HEIGHT_RATIO = 0.22;
const ZONE_RESIZE_SCALE = {
  left: 2,
  center: 2.5,
  right: 2,
};

let workerPromise = null;

export async function extractMatchSummaryOcr({ imagePath }) {
  const resolvedImagePath = resolve(process.cwd(), String(imagePath ?? ""));
  const provider = resolveProvider(process.env.MATCH_SUMMARY_OCR_PROVIDER);
  const fixtureResult = readFixtureResult(resolvedImagePath);

  if (fixtureResult && provider !== LIVE_OCR_PROVIDER) {
    return {
      layoutVersion: LAYOUT_VERSION,
      leftText: fixtureResult.leftText,
      centerText: fixtureResult.centerText,
      rightText: fixtureResult.rightText,
      metadata: {
        provider: fixtureResult.provider,
        imagePath: resolvedImagePath,
        fixturePaths: fixtureResult.fixturePaths,
      },
    };
  }

  if (provider === "fixture") {
    throw new Error(buildMissingFixtureMessage(resolvedImagePath));
  }

  return extractLiveTesseractResult({ imagePath: resolvedImagePath });
}

export async function disposeMatchSummaryOcr() {
  if (!workerPromise) {
    return;
  }

  const pendingWorker = workerPromise;
  workerPromise = null;

  try {
    const worker = await pendingWorker;
    await worker.terminate();
  } catch {
    // Ignore shutdown errors so CLI cleanup never hides the real pipeline result.
  }
}

function resolveProvider(value) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return DEFAULT_PROVIDER;
  }

  if (!SUPPORTED_PROVIDERS.has(normalized)) {
    throw new Error(
      `Unsupported MATCH_SUMMARY_OCR_PROVIDER="${normalized}". Supported values: auto, fixture, tesseract.`,
    );
  }

  return normalized === "tesseract.js" ? LIVE_OCR_PROVIDER : normalized;
}

async function extractLiveTesseractResult({ imagePath }) {
  try {
    const baseImage = sharp(imagePath, { failOn: "error" }).rotate();
    const metadata = await baseImage.metadata();
    const width = toPositiveInteger(metadata.width, "image width");
    const height = toPositiveInteger(metadata.height, "image height");
    const zones = getMatchSummaryZones(width, height);
    const worker = await getTesseractWorker();
    const zoneTexts = {};
    const ocrRectangles = {};

    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
      user_defined_dpi: "300",
    });

    for (const zoneName of OCR_ZONE_NAMES) {
      const rectangle = buildOcrRectangle({
        zoneName,
        zone: zones[zoneName],
        imageWidth: width,
        imageHeight: height,
      });

      ocrRectangles[zoneName] = rectangle;
      zoneTexts[`${zoneName}Text`] = await recognizeZone({
        baseImage,
        worker,
        zoneName,
        rectangle,
      });
    }

    return {
      layoutVersion: LAYOUT_VERSION,
      leftText: zoneTexts.leftText,
      centerText: zoneTexts.centerText,
      rightText: zoneTexts.rightText,
      metadata: {
        provider: "tesseract.js",
        imagePath,
        cachePath: TESSERACT_CACHE_PATH,
        image: {
          width,
          height,
        },
        preprocessing: {
          centerHeightRatio: CENTER_HEIGHT_RATIO,
          horizontalOverlapRatio: ZONE_HORIZONTAL_OVERLAP_RATIO,
          resizeScale: ZONE_RESIZE_SCALE,
        },
        ocrRectangles,
      },
    };
  } catch (error) {
    throw new Error(buildLiveOcrErrorMessage(imagePath, error));
  }
}

async function recognizeZone({ baseImage, worker, zoneName, rectangle }) {
  const resizeScale = ZONE_RESIZE_SCALE[zoneName] ?? 2;
  const buffer = await baseImage
    .clone()
    .extract(rectangle)
    .resize({
      width: Math.max(Math.round(rectangle.width * resizeScale), rectangle.width),
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();

  const {
    data: { text },
  } = await worker.recognize(buffer);

  return normalizeRecognizedText(text);
}

function buildOcrRectangle({ zoneName, zone, imageWidth, imageHeight }) {
  const overlap = Math.max(Math.round(imageWidth * ZONE_HORIZONTAL_OVERLAP_RATIO), 12);

  if (zoneName === "left") {
    return clampRectangle({
      left: zone.x,
      top: zone.y,
      width: zone.width + overlap,
      height: zone.height,
      imageWidth,
      imageHeight,
    });
  }

  if (zoneName === "right") {
    return clampRectangle({
      left: zone.x - overlap,
      top: zone.y,
      width: zone.width + overlap,
      height: zone.height,
      imageWidth,
      imageHeight,
    });
  }

  return clampRectangle({
    left: zone.x - overlap,
    top: 0,
    width: zone.width + overlap * 2,
    height: Math.round(imageHeight * CENTER_HEIGHT_RATIO),
    imageWidth,
    imageHeight,
  });
}

function clampRectangle({ left, top, width, height, imageWidth, imageHeight }) {
  const safeLeft = Math.max(0, Math.min(Math.round(left), imageWidth - 1));
  const safeTop = Math.max(0, Math.min(Math.round(top), imageHeight - 1));
  const safeWidth = Math.max(1, Math.min(Math.round(width), imageWidth - safeLeft));
  const safeHeight = Math.max(1, Math.min(Math.round(height), imageHeight - safeTop));

  return {
    left: safeLeft,
    top: safeTop,
    width: safeWidth,
    height: safeHeight,
  };
}

function readFixtureResult(imagePath) {
  const jsonFixturePath = replaceExtension(imagePath, ".ocr.json");

  if (existsSync(jsonFixturePath)) {
    const fixture = JSON.parse(readFileSync(jsonFixturePath, "utf8"));
    const zonalText = normalizeFixtureObject(fixture);

    return {
      ...zonalText,
      provider: "fixture-json",
      fixturePaths: [jsonFixturePath],
    };
  }

  const zonalTextFixture = readZonalTextFixture(imagePath);

  if (zonalTextFixture) {
    return zonalTextFixture;
  }

  const combinedTextFixturePath = replaceExtension(imagePath, ".ocr.txt");

  if (existsSync(combinedTextFixturePath)) {
    return {
      ...parseCombinedTextFixture(readFileSync(combinedTextFixturePath, "utf8")),
      provider: "fixture-text",
      fixturePaths: [combinedTextFixturePath],
    };
  }

  return null;
}

function normalizeFixtureObject(fixture) {
  const zones = fixture?.zones ?? {};
  const leftText = toZoneText(fixture?.leftText ?? zones.leftText ?? zones.left);
  const centerText = toZoneText(fixture?.centerText ?? zones.centerText ?? zones.center);
  const rightText = toZoneText(fixture?.rightText ?? zones.rightText ?? zones.right);

  return {
    leftText,
    centerText,
    rightText,
  };
}

function readZonalTextFixture(imagePath) {
  const zoneTexts = {};
  const fixturePaths = [];

  for (const zoneName of OCR_ZONE_NAMES) {
    const zonePath = replaceExtension(imagePath, `.${zoneName}.txt`);

    if (!existsSync(zonePath)) {
      return null;
    }

    fixturePaths.push(zonePath);
    zoneTexts[`${zoneName}Text`] = readFileSync(zonePath, "utf8").trim();
  }

  return {
    ...zoneTexts,
    provider: "fixture-zonal-text",
    fixturePaths,
  };
}

function parseCombinedTextFixture(input) {
  const sections = new Map();
  let currentSection = null;

  for (const line of String(input ?? "").split(/\r?\n/)) {
    const maybeSection = getSectionName(line);

    if (maybeSection) {
      currentSection = maybeSection;

      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }

      continue;
    }

    if (currentSection) {
      sections.get(currentSection).push(line);
    }
  }

  return {
    leftText: toZoneText(sections.get("left")?.join("\n")),
    centerText: toZoneText(sections.get("center")?.join("\n")),
    rightText: toZoneText(sections.get("right")?.join("\n")),
  };
}

function getSectionName(line) {
  const normalized = String(line ?? "")
    .trim()
    .replace(/^[\[\](){}<>=\-:\s]+|[\[\](){}<>=\-:\s]+$/g, "")
    .toLowerCase();

  if (normalized === "left" || normalized === "center" || normalized === "right") {
    return normalized;
  }

  return null;
}

function normalizeRecognizedText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toZoneText(value) {
  return String(value ?? "").trim();
}

async function getTesseractWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      cachePath: TESSERACT_CACHE_PATH,
      logger: () => {},
    });
  }

  return workerPromise;
}

function replaceExtension(filePath, nextExtension) {
  const currentExtension = extname(filePath);

  if (!currentExtension) {
    return `${filePath}${nextExtension}`;
  }

  return `${filePath.slice(0, -currentExtension.length)}${nextExtension}`;
}

function buildMissingFixtureMessage(imagePath) {
  const parentDirectory = dirname(imagePath);
  const basenameWithoutExtension = extname(imagePath)
    ? imagePath.slice(0, -extname(imagePath).length)
    : imagePath;

  return [
    `MATCH_SUMMARY_OCR_PROVIDER=fixture was requested, but no sibling OCR fixture exists for ${imagePath}.`,
    `Create one of these sibling fixtures under ${parentDirectory}:`,
    `- ${basenameWithoutExtension}.ocr.json with { \"leftText\": \"...\", \"centerText\": \"...\", \"rightText\": \"...\" }`,
    `- ${basenameWithoutExtension}.left.txt + .center.txt + .right.txt`,
    `- ${basenameWithoutExtension}.ocr.txt with LEFT / CENTER / RIGHT sections`,
    "Or unset MATCH_SUMMARY_OCR_PROVIDER to let the local tesseract.js OCR runtime process the image directly.",
  ].join("\n");
}

function buildLiveOcrErrorMessage(imagePath, error) {
  const details = error instanceof Error ? error.message : String(error);

  return [
    `Local OCR failed for ${imagePath}.`,
    `Cause: ${details}`,
    "The local OCR runtime uses tesseract.js and may need network access the first time it downloads the English language model into .cache/tesseract.",
    "For deterministic fixture-driven runs, add a sibling .ocr.json/.ocr.txt fixture or set MATCH_SUMMARY_OCR_PROVIDER=fixture.",
  ].join("\n");
}

function toPositiveInteger(value, label) {
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive ${label}, received "${value}".`);
  }

  return parsed;
}
