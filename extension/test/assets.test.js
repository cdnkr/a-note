const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const extensionRoot = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));

test("layout helpers load before the content script", () => {
  assert.deepEqual(
    manifest.content_scripts[0].js,
    ["config.js", "lib.js", "layout.js", "content.js"],
  );
  const background = fs.readFileSync(path.join(extensionRoot, "background.js"), "utf8");
  assert.match(background, /files: \["config\.js", "lib\.js", "layout\.js", "content\.js"\]/);
});

test("all referenced Excalifont subsets are packaged and web accessible", () => {
  const content = fs.readFileSync(path.join(extensionRoot, "content.js"), "utf8");
  const referencedFonts = [...content.matchAll(/file: "(Excalifont-Regular-[a-f0-9]+\.woff2)"/g)]
    .map((match) => match[1]);

  assert.equal(referencedFonts.length, 7);
  referencedFonts.forEach((font) => {
    const stats = fs.statSync(path.join(extensionRoot, "fonts", font));
    assert.ok(stats.size > 0, `${font} should not be empty`);
  });
  assert.ok(
    manifest.web_accessible_resources.some((entry) => entry.resources.includes("fonts/*.woff2")),
  );
});

test("the bundled font includes its copyright notice and complete OFL terms", () => {
  const license = fs.readFileSync(path.join(extensionRoot, "fonts", "OFL.txt"), "utf8");
  assert.match(license, /Copyright \(c\) 2024 by Excalidraw/);
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(license, /PERMISSION & CONDITIONS/);
  assert.match(license, /DISCLAIMER/);
});
