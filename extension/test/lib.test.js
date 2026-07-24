const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_CONTENT_LENGTH,
  isShareColorToken,
  isShareId,
  pageUrl,
  sharePageUrl,
  withShareColor,
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

test("share IDs and share-page URLs are validated", () => {
  assert.equal(isShareId(SHARE_ID), true);
  assert.equal(isShareId("too-short"), false);
  assert.equal(sharePageUrl("https://annotate.example/path", SHARE_ID), `https://annotate.example/s/${SHARE_ID}`);
  assert.equal(
    sharePageUrl("https://annotate.example/path", SHARE_ID, "orange"),
    `https://annotate.example/s/${SHARE_ID}?c=orange`,
  );
});

test("share-page URLs include only supported colour tokens", () => {
  assert.equal(isShareColorToken("teal"), true);
  assert.equal(isShareColorToken("chartreuse"), false);
  assert.equal(
    withShareColor(`https://annotate.example/s/${SHARE_ID}?source=extension`, "teal"),
    `https://annotate.example/s/${SHARE_ID}?source=extension&c=teal`,
  );
  assert.equal(
    withShareColor(`https://annotate.example/s/${SHARE_ID}?c=teal`, "chartreuse"),
    `https://annotate.example/s/${SHARE_ID}`,
  );
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
