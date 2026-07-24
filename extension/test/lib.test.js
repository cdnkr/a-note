const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_CONTENT_LENGTH,
  dedupeAnnotations,
  isShareId,
  pageUrl,
  readShareId,
  sharePageUrl,
  targetUrl,
  xpathForElement,
  xpathLiteral,
} = require("../lib.js");

const SHARE_ID = "AbCdEfGhIjKlMnOpQrStUv";

test("pageUrl removes only annotateShare and preserves path, search, and hash", () => {
  assert.equal(
    pageUrl(`https://example.com/path?plan=pro&x=%2Fhtml&c=hello&annotateShare=${SHARE_ID}#pricing`),
    "https://example.com/path?plan=pro&x=%2Fhtml&c=hello#pricing",
  );
});

test("target URL round trips a valid share ID", () => {
  const result = targetUrl("https://example.com/page?view=wide#hero", SHARE_ID);
  assert.equal(readShareId(result), SHARE_ID);
  assert.equal(new URL(result).hash, "#hero");
  assert.equal(new URL(result).searchParams.get("view"), "wide");
});

test("share IDs and share-page URLs are validated", () => {
  assert.equal(isShareId(SHARE_ID), true);
  assert.equal(readShareId("https://example.com/?annotateShare=too-short"), null);
  assert.equal(sharePageUrl("https://annotate.example/path", SHARE_ID), `https://annotate.example/s/${SHARE_ID}`);
  assert.throws(() => targetUrl("https://example.com", "invalid"), /Invalid share ID/);
});

test("dedupeAnnotations checks share ID first and fingerprint second", () => {
  assert.equal(dedupeAnnotations([
    { xpath: "/p[1]", content: "Same", id: "one", shareId: SHARE_ID },
    { xpath: "/p[2]", content: "Different", id: "two", shareId: SHARE_ID },
    { xpath: "/p[1]", content: "Same", id: "three" },
    { xpath: "/p[1]", content: "Different", id: "three" },
  ]).length, 2);
});

test("content length remains 240 characters", () => {
  assert.equal(MAX_CONTENT_LENGTH, 240);
});

test("xpathLiteral safely handles IDs containing both quote styles", () => {
  assert.equal(xpathLiteral("it's-a-\"test\""), `concat('it',"'",'s-a-"test"')`);
  assert.equal(
    xpathForElement({ nodeType: 1, id: "it's-a-\"test\"" }),
    `//*[@id=concat('it',"'",'s-a-"test"')]`,
  );
});
