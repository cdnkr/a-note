import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(webRoot, "..");
const brandRoot = path.join(webRoot, "brand");
const extensionRoot = path.join(repositoryRoot, "extension");
const extensionIconRoot = path.join(extensionRoot, "public", "icons");
const webIconRoot = path.join(webRoot, "public", "icons");
const masterIconPath = path.join(brandRoot, "a-icon.svg");
const palettePath = path.join(brandRoot, "palette.json");
const generatedExtensionBrandPath = path.join(extensionRoot, "src", "brand.js");
const faviconPath = path.join(webRoot, "public", "favicon.svg");
const pngSizes = Object.freeze([16, 24, 32, 48, 128]);
const checkOnly = process.argv.includes("--check");

const [masterIcon, paletteSource] = await Promise.all([
  readFile(masterIconPath, "utf8"),
  readFile(palettePath, "utf8"),
]);
const palette = validatePalette(JSON.parse(paletteSource));
validateMasterIcon(masterIcon);

const expectedFiles = new Map();
for (const color of palette.colors) {
  const svg = renderVariant(masterIcon, color);
  const svgName = `a-${color.id}.svg`;
  expectedFiles.set(path.join(extensionIconRoot, svgName), Buffer.from(svg));
  expectedFiles.set(path.join(webIconRoot, svgName), Buffer.from(svg));

  for (const size of pngSizes) {
    const png = await sharp(Buffer.from(svg))
      .resize(size, size, { fit: "fill" })
      .png({ compressionLevel: 9, adaptiveFiltering: false })
      .toBuffer();
    expectedFiles.set(
      path.join(extensionIconRoot, `a-${color.id}-${size}.png`),
      png,
    );
  }
}

const defaultSvg = expectedFiles.get(
  path.join(webIconRoot, `a-${palette.defaultColorId}.svg`),
);
expectedFiles.set(faviconPath, defaultSvg);
expectedFiles.set(
  generatedExtensionBrandPath,
  Buffer.from(extensionBrandModule(palette)),
);

if (checkOnly) {
  await checkGeneratedFiles(expectedFiles);
  console.log(`Brand assets are current (${expectedFiles.size} files).`);
} else {
  await removeStaleGeneratedFiles(expectedFiles);
  await Promise.all([...expectedFiles].map(async ([filePath, contents]) => {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }));
  console.log(`Generated ${expectedFiles.size} brand files.`);
}

function validatePalette(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.colors)) {
    throw new TypeError("Brand palette must contain a colors array");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(value.defaultColorId || "")) {
    throw new TypeError("Brand palette has an invalid defaultColorId");
  }
  if (typeof value.storageKey !== "string" || !value.storageKey) {
    throw new TypeError("Brand palette has an invalid storageKey");
  }

  const seen = new Set();
  const colors = value.colors.map((color) => {
    if (!color || typeof color !== "object") throw new TypeError("Invalid brand color");
    if (!/^[a-z][a-z0-9-]*$/.test(color.id || "") || seen.has(color.id)) {
      throw new TypeError(`Invalid or duplicate brand color: ${color.id}`);
    }
    for (const key of ["label", "value", "darkValue", "rgb", "foreground"]) {
      if (typeof color[key] !== "string" || !color[key]) {
        throw new TypeError(`Brand color ${color.id} is missing ${key}`);
      }
    }
    for (const key of ["value", "darkValue", "foreground"]) {
      if (!/^#[0-9a-f]{6}$/i.test(color[key])) {
        throw new TypeError(`Brand color ${color.id} has invalid ${key}`);
      }
    }
    seen.add(color.id);
    return Object.freeze({ ...color });
  });
  if (!seen.has(value.defaultColorId)) {
    throw new TypeError("Brand palette defaultColorId is not defined");
  }
  return Object.freeze({ ...value, colors: Object.freeze(colors) });
}

function validateMasterIcon(svg) {
  if (!svg.includes('viewBox="0 0 42 42"')) {
    throw new Error("Master brand icon must retain its 42×42 viewBox");
  }
  for (const id of ["a-icon-background", "a-icon-glyph"]) {
    const matches = svg.match(new RegExp(`\\bid="${id}"`, "g")) || [];
    if (matches.length !== 1) throw new Error(`Master brand icon must contain one ${id}`);
  }
}

function renderVariant(svg, color) {
  return replacePathFill(
    replacePathFill(svg, "a-icon-background", color.value),
    "a-icon-glyph",
    color.foreground,
  );
}

function replacePathFill(svg, id, fill) {
  const pathPattern = new RegExp(`<path\\b[^>]*\\bid="${id}"[^>]*>`, "i");
  if (!pathPattern.test(svg)) throw new Error(`Could not find SVG path ${id}`);
  return svg.replace(pathPattern, (pathTag) => {
    if (!/\bfill="[^"]*"/i.test(pathTag)) {
      throw new Error(`SVG path ${id} does not have a fill`);
    }
    return pathTag.replace(/\bfill="[^"]*"/i, `fill="${fill}"`);
  });
}

function extensionBrandModule(value) {
  const serializedColors = JSON.stringify(value.colors, null, 2)
    .split("\n")
    .map((line, index) => index === 0 ? line : `  ${line}`)
    .join("\n");
  return `(function (root) {
  "use strict";

  const COLOR_STORAGE_KEY = ${JSON.stringify(value.storageKey)};
  const DEFAULT_COLOR_ID = ${JSON.stringify(value.defaultColorId)};
  const COLORS = Object.freeze(${serializedColors}.map((color) => Object.freeze(color)));
  const COLORS_BY_ID = new Map(COLORS.map((color) => [color.id, color]));

  function colorById(colorId) {
    return COLORS_BY_ID.get(String(colorId)) || COLORS_BY_ID.get(DEFAULT_COLOR_ID);
  }

  function svgPath(colorId) {
    return \`icons/a-\${colorById(colorId).id}.svg\`;
  }

  function pngPaths(colorId) {
    const id = colorById(colorId).id;
    return Object.freeze({
      16: \`icons/a-\${id}-16.png\`,
      24: \`icons/a-\${id}-24.png\`,
      32: \`icons/a-\${id}-32.png\`,
      48: \`icons/a-\${id}-48.png\`,
      128: \`icons/a-\${id}-128.png\`,
    });
  }

  root.ANoteBrand = Object.freeze({
    COLOR_STORAGE_KEY,
    DEFAULT_COLOR_ID,
    COLORS,
    colorById,
    svgPath,
    pngPaths,
  });
})(globalThis);
`;
}

async function checkGeneratedFiles(expected) {
  const failures = [];
  for (const [filePath, expectedContents] of expected) {
    try {
      await access(filePath, fsConstants.R_OK);
      const actualContents = await readFile(filePath);
      if (!actualContents.equals(expectedContents)) failures.push(relative(filePath));
    } catch {
      failures.push(relative(filePath));
    }
  }
  failures.push(...await staleGeneratedFiles(expected));
  if (failures.length) {
    throw new Error(`Brand assets are missing or stale:\n${[...new Set(failures)].sort().join("\n")}`);
  }
}

async function removeStaleGeneratedFiles(expected) {
  const stale = await staleGeneratedFiles(expected, true);
  await Promise.all(stale.map((filePath) => unlink(filePath)));
}

async function staleGeneratedFiles(expected, absolute = false) {
  const stale = [];
  for (const directory of [extensionIconRoot, webIconRoot]) {
    let names = [];
    try {
      names = await readdir(directory);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    for (const name of names) {
      if (!/^a-[a-z0-9-]+\.(?:svg|png)$/.test(name)) continue;
      const filePath = path.join(directory, name);
      if (!expected.has(filePath)) stale.push(absolute ? filePath : relative(filePath));
    }
  }
  return stale;
}

function relative(filePath) {
  return path.relative(repositoryRoot, filePath);
}
