const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const libPath = path.resolve(__dirname, "../src/lib.js");
vm.runInThisContext(fs.readFileSync(libPath, "utf8"), { filename: libPath });
const {
  MAX_CONTENT_LENGTH,
  isStableClass,
  isStableId,
  isShareColorToken,
  isShareId,
  pageUrl,
  resolveXPath,
  sharePageUrl,
  splitCompoundXPath,
  withShareColor,
  xpathForElement,
  xpathLiteral,
} = globalThis.ANoteLib;
delete globalThis.ANoteLib;
const palette = require("../../web/brand/palette.json");

const SHARE_ID = "AbCdEfGhIjKlMnOpQrStUv";

test("pageUrl removes only aNoteShare and preserves path, search, and hash", () => {
  assert.equal(
    pageUrl(`https://example.com/path?plan=pro&x=%2Fhtml&c=hello&aNoteShare=${SHARE_ID}#pricing`),
    "https://example.com/path?plan=pro&x=%2Fhtml&c=hello#pricing",
  );
});

test("share IDs and share-page URLs are validated", () => {
  assert.equal(isShareId(SHARE_ID), true);
  assert.equal(isShareId("too-short"), false);
  assert.equal(sharePageUrl("https://a-note.example/path", SHARE_ID), `https://a-note.example/s/${SHARE_ID}`);
  assert.equal(
    sharePageUrl("https://a-note.example/path", SHARE_ID, "orange"),
    `https://a-note.example/s/${SHARE_ID}?c=orange`,
  );
});

test("share-page URLs include only supported colour tokens", () => {
  assert.equal(isShareColorToken("teal"), true);
  assert.equal(isShareColorToken("chartreuse"), false);
  assert.equal(
    withShareColor(`https://a-note.example/s/${SHARE_ID}?source=extension`, "teal"),
    `https://a-note.example/s/${SHARE_ID}?source=extension&c=teal`,
  );
  assert.equal(
    withShareColor(`https://a-note.example/s/${SHARE_ID}?c=teal`, "chartreuse"),
    `https://a-note.example/s/${SHARE_ID}`,
  );
});

test("share colour tokens stay aligned with the canonical brand palette", () => {
  palette.colors.forEach((color) => assert.equal(isShareColorToken(color.id), true));
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

test("stable selector heuristics reject common generated identifiers and classes", () => {
  assert.equal(isStableId("checkout-submit"), true);
  assert.equal(isStableId("react123"), false);
  assert.equal(isStableId(":r8:"), false);
  assert.equal(isStableId("550e8400-e29b-41d4-a716-446655440000"), false);
  assert.equal(isStableClass("checkout__submit"), true);
  assert.equal(isStableClass("css-a1b2c3d4"), false);
  assert.equal(isStableClass("md:hover:block"), false);
});

test("compound XPath splitting preserves separators inside quoted literals", () => {
  assert.deepEqual(
    splitCompoundXPath(`//*[@id='left|right']|./section[1]/button[1]`),
    [`//*[@id='left|right']`, "./section[1]/button[1]"],
  );
  assert.deepEqual(
    splitCompoundXPath(`//*[@id=concat('left',"'",'|right')]|./button[1]`),
    [`//*[@id=concat('left',"'",'|right')]`, "./button[1]"],
  );
});

test("candidate validation requires the unique match to be the requested element", () => {
  const other = { nodeType: 1 };
  const target = fakeElement("button", {
    id: "save-button",
    "data-testid": "save-action",
  });
  const matches = new Map([
    [`//*[@id='save-button']`, [other]],
    [`//button[@data-testid='save-action']`, [target]],
    ["/button[1]", [target]],
  ]);
  const doc = fakeXPathDocument(matches);
  target.ownerDocument = doc;
  target.getRootNode = () => doc;

  assert.equal(xpathForElement(target), `//button[@data-testid='save-action']`);
});

test("compound XPath resolution traverses deterministic open shadow-root paths", () => {
  const button = fakeElement("button");
  const wrapper = fakeElement("div");
  wrapper.children = [button];
  const host = fakeElement("settings-panel", { id: "settings" });
  const shadowRoot = { nodeType: 11, host, children: [wrapper] };
  host.shadowRoot = shadowRoot;
  const doc = fakeXPathDocument(new Map([
    [`//*[@id='settings']`, [host]],
  ]));

  assert.equal(
    resolveXPath(`//*[@id='settings']|./div[1]/button[1]`, doc),
    button,
  );
});

function fakeElement(localName, attributes = {}) {
  const entries = Object.entries(attributes);
  return {
    nodeType: 1,
    localName,
    tagName: localName.toUpperCase(),
    namespaceURI: "http://www.w3.org/1999/xhtml",
    id: attributes.id || "",
    attributes: entries.map(([name, value]) => ({ name, value })),
    classList: [],
    children: [],
    parentElement: null,
    previousElementSibling: null,
    textContent: "",
    getAttribute(name) {
      return Object.hasOwn(attributes, name) ? attributes[name] : null;
    },
  };
}

function fakeXPathDocument(matches) {
  return {
    nodeType: 9,
    evaluate(xpath, _scope, _resolver, resultType) {
      const nodes = matches.get(xpath) || [];
      if (resultType === 9) return { singleNodeValue: nodes[0] || null };
      return {
        snapshotLength: nodes.length,
        snapshotItem(index) {
          return nodes[index] || null;
        },
      };
    },
  };
}
