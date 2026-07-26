const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const extensionRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(extensionRoot, "..");
const sourceRoot = path.join(extensionRoot, "src");
const publicRoot = path.join(extensionRoot, "public");
const distRoot = path.join(extensionRoot, "dist");
const manifest = JSON.parse(fs.readFileSync(path.join(publicRoot, "manifest.json"), "utf8"));
const palette = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "web", "brand", "palette.json"), "utf8"));

test("the packaged annotator is injected in dependency order without persistent host access", () => {
  assert.deepEqual(manifest.permissions, ["storage", "activeTab", "scripting"]);
  assert.equal("content_scripts" in manifest, false);
  const background = fs.readFileSync(path.join(sourceRoot, "background.js"), "utf8");
  assert.match(
    background,
    /files: \["brand\.js", "lib\.js", "layout\.js", "widget\.js", "content\.js"\]/,
  );
});

test("all referenced Excalifont subsets are packaged and web accessible", () => {
  const widget = fs.readFileSync(path.join(sourceRoot, "widget.js"), "utf8");
  const referencedFonts = [...widget.matchAll(/file: "(Excalifont-Regular-[a-f0-9]+\.woff2)"/g)]
    .map((match) => match[1]);

  assert.equal(referencedFonts.length, 7);
  referencedFonts.forEach((font) => {
    const stats = fs.statSync(path.join(publicRoot, "fonts", font));
    assert.ok(stats.size > 0, `${font} should not be empty`);
  });
  assert.ok(
    manifest.web_accessible_resources.some((entry) => entry.resources.includes("fonts/*.woff2")),
  );
});

test("generated icon variants match the canonical palette and dimensions", () => {
  const context = vm.createContext({});
  vm.runInContext(
    fs.readFileSync(path.join(sourceRoot, "brand.js"), "utf8"),
    context,
  );
  const brand = context.ANoteBrand;

  assert.equal(brand.DEFAULT_COLOR_ID, palette.defaultColorId);
  assert.equal(brand.COLOR_STORAGE_KEY, palette.storageKey);
  assert.deepEqual(
    Array.from(brand.COLORS, (color) => color.id),
    palette.colors.map((color) => color.id),
  );
  assert.equal(brand.colorById("chartreuse").id, "cobalt");

  palette.colors.forEach((color) => {
    const svgPath = path.join(publicRoot, "icons", `a-${color.id}.svg`);
    const svg = fs.readFileSync(svgPath, "utf8");
    assert.match(svg, new RegExp(`id="a-icon-background"[^>]+fill="${color.value}"`, "i"));
    assert.match(svg, new RegExp(`id="a-icon-glyph"[^>]+fill="${color.foreground}"`, "i"));

    [16, 24, 32, 48, 128].forEach((size) => {
      const pngPath = path.join(publicRoot, "icons", `a-${color.id}-${size}.png`);
      const png = fs.readFileSync(pngPath);
      assert.deepEqual(png.subarray(1, 4).toString("ascii"), "PNG");
      assert.equal(png.readUInt32BE(16), size);
      assert.equal(png.readUInt32BE(20), size);
    });
  });
});

test("manifest uses cobalt package icons and exposes in-page SVG variants", () => {
  assert.deepEqual(manifest.icons, {
    16: "icons/a-cobalt-16.png",
    32: "icons/a-cobalt-32.png",
    48: "icons/a-cobalt-48.png",
    128: "icons/a-cobalt-128.png",
  });
  assert.deepEqual(manifest.action.default_icon, {
    16: "icons/a-cobalt-16.png",
    24: "icons/a-cobalt-24.png",
    32: "icons/a-cobalt-32.png",
  });
  assert.ok(
    manifest.web_accessible_resources.some((entry) => entry.resources.includes("icons/*.svg")),
  );
});

test("the bundled font includes its copyright notice and complete OFL terms", () => {
  const license = fs.readFileSync(path.join(publicRoot, "fonts", "OFL.txt"), "utf8");
  assert.match(license, /Copyright \(c\) 2024 by Excalidraw/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(license, /PERMISSION & CONDITIONS/);
  assert.match(license, /DISCLAIMER/);
});

test("the Vite build emits a complete minified extension package", () => {
  const builtManifest = JSON.parse(
    fs.readFileSync(path.join(distRoot, "manifest.json"), "utf8"),
  );
  assert.deepEqual(builtManifest, manifest);

  const scriptNames = [
    "background.js",
    "brand.js",
    "lib.js",
    "layout.js",
    "widget.js",
    "content.js",
  ];
  let sourceBytes = 0;
  let builtBytes = 0;
  scriptNames.forEach((name) => {
    const source = fs.readFileSync(path.join(sourceRoot, name));
    const built = fs.readFileSync(path.join(distRoot, name));
    sourceBytes += source.length;
    builtBytes += built.length;
    assert.doesNotThrow(
      () => new vm.Script(built.toString("utf8"), { filename: name }),
      `${name} should be valid as a classic extension script`,
    );
  });
  assert.ok(builtBytes < sourceBytes, "built JavaScript should be smaller than source");

  const builtGlobals = vm.createContext({});
  ["brand.js", "lib.js", "layout.js", "widget.js"].forEach((name) => {
    const script = fs.readFileSync(path.join(distRoot, name), "utf8");
    vm.runInContext(script, builtGlobals, { filename: name });
  });
  assert.ok(builtGlobals.ANoteBrand);
  assert.ok(builtGlobals.ANoteLib);
  assert.ok(builtGlobals.ANoteLayout);
  assert.ok(builtGlobals.ANoteWidget);

  [
    "fonts/OFL.txt",
    "fonts/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2",
    "icons/a-cobalt.svg",
    "icons/a-cobalt-128.png",
  ].forEach((relativePath) => {
    assert.ok(
      fs.statSync(path.join(distRoot, relativePath)).size > 0,
      `${relativePath} should be included in dist`,
    );
  });
  assert.equal(fs.existsSync(path.join(distRoot, "package.json")), false);
  assert.equal(fs.existsSync(path.join(distRoot, "test")), false);
});
