const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const libPath = path.resolve(__dirname, "../src/lib.js");
vm.runInThisContext(fs.readFileSync(libPath, "utf8"), { filename: libPath });
const {
  MAX_CONTENT_LENGTH,
  findTextQuoteOffset,
  isStableClass,
  isStableId,
  isTextTarget,
  pageUrl,
  resolveXPath,
  resolveTextTarget,
  splitCompoundXPath,
  textTargetForRange,
  textTargetKey,
  xpathForElement,
  xpathLiteral,
} = globalThis.ANoteLib;
delete globalThis.ANoteLib;

const SHARE_ID = "AbCdEfGhIjKlMnOpQrStUv";

test("pageUrl removes only aNoteShare and preserves path, search, and hash", () => {
  assert.equal(
    pageUrl(`https://example.com/path?plan=pro&x=%2Fhtml&c=hello&aNoteShare=${SHARE_ID}#pricing`),
    "https://example.com/path?plan=pro&x=%2Fhtml&c=hello#pricing",
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

test("text targets serialize and resolve exact multi-node selections", () => {
  const rootRef = { current: null };
  const doc = fakeTextDocument(rootRef);
  const root = fakeTextElement("p", doc, [
    fakeTextNode("Intro Hello ", doc),
    fakeTextElement("strong", doc, [fakeTextNode("brave", doc)]),
    fakeTextNode(" world Outro", doc),
  ]);
  rootRef.current = root;
  doc.body = root;

  const range = fakeTextRange(
    root,
    root.childNodes[0],
    "Intro ".length,
    root.childNodes[2],
    " world".length,
  );
  const target = textTargetForRange(range);

  assert.deepEqual(target, {
    type: "text",
    rootXPath: "/p[1]",
    startOffset: 6,
    endOffset: 23,
    quote: {
      exact: "Hello brave world",
      prefix: "Intro ",
      suffix: " Outro",
    },
  });
  assert.equal(resolveTextTarget(target, doc).toString(), "Hello brave world");
});

test("text target quote fallback survives offset shifts and text-node wrappers", () => {
  const context = "0123456789".repeat(4);
  const rootRef = { current: null };
  const doc = fakeTextDocument(rootRef);
  const original = fakeTextElement("p", doc, [
    fakeTextNode(`${context}Hello `, doc),
    fakeTextElement("span", doc, [fakeTextNode("brave", doc)]),
    fakeTextNode(" world", doc),
  ]);
  rootRef.current = original;
  doc.body = original;
  const target = textTargetForRange(fakeTextRange(
    original,
    original.childNodes[0],
    context.length,
    original.childNodes[2],
    " world".length,
  ));

  const replacement = fakeTextElement("p", doc, [
    fakeTextNode(`X${context}`, doc),
    fakeTextElement("em", doc, [
      fakeTextNode("Hello brave", doc),
      fakeTextElement("span", doc, [fakeTextNode(" world", doc)]),
    ]),
  ]);
  rootRef.current = replacement;
  doc.body = replacement;

  assert.equal(resolveTextTarget(target, doc).toString(), "Hello brave world");
});

test("text quote fallback rejects ambiguous matches", () => {
  assert.equal(
    findTextQuoteOffset(
      "same text then same text",
      { exact: "same text", prefix: "", suffix: "" },
    ),
    null,
  );
  assert.equal(
    findTextQuoteOffset(
      "left same text then right same text",
      { exact: "same text", prefix: "left ", suffix: " then" },
    ),
    5,
  );
});

test("text target keys group copied ranges without changing legacy annotations", () => {
  const target = {
    type: "text",
    rootXPath: "//*[@id='copy']",
    startOffset: 2,
    endOffset: 6,
    quote: { exact: "copy", prefix: "", suffix: "" },
  };
  assert.equal(isTextTarget(target), true);
  assert.equal(textTargetKey(target), textTargetKey(structuredClone(target)));
  assert.equal(isTextTarget({ id: "legacy", xpath: "/html[1]/body[1]" }), false);
  assert.equal(textTargetKey({ xpath: "/html[1]/body[1]" }), "");
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

function fakeTextNode(value, doc) {
  return {
    nodeType: 3,
    nodeValue: value,
    textContent: value,
    childNodes: [],
    parentElement: null,
    parentNode: null,
    ownerDocument: doc,
    getRootNode() {
      return doc;
    },
  };
}

function fakeTextElement(localName, doc, children = []) {
  const element = fakeElement(localName);
  element.ownerDocument = doc;
  element.childNodes = children;
  element.children = children.filter((child) => child.nodeType === 1);
  element.getRootNode = () => doc;
  children.forEach((child, index) => {
    child.parentElement = element;
    child.parentNode = element;
    if (child.nodeType === 1) {
      const previousElements = children
        .slice(0, index)
        .filter((candidate) => candidate.nodeType === 1);
      child.previousElementSibling = previousElements.at(-1) || null;
    }
  });
  Object.defineProperty(element, "textContent", {
    configurable: true,
    get() {
      return flattenFakeTextNodes(element)
        .map((node) => node.nodeValue)
        .join("");
    },
  });
  return element;
}

function fakeTextRange(root, startNode, startOffset, endNode, endOffset) {
  return {
    collapsed: startNode === endNode && startOffset === endOffset,
    commonAncestorContainer: root,
    startContainer: startNode,
    startOffset,
    endContainer: endNode,
    endOffset,
    toString() {
      return fakeRangeString(root, startNode, startOffset, endNode, endOffset);
    },
  };
}

function fakeTextDocument(rootRef) {
  const doc = {
    nodeType: 9,
    body: null,
    evaluate(xpath, _scope, _resolver, resultType) {
      const nodes = xpath === "/p[1]" && rootRef.current ? [rootRef.current] : [];
      if (resultType === 9) return { singleNodeValue: nodes[0] || null };
      return {
        snapshotLength: nodes.length,
        snapshotItem(index) {
          return nodes[index] || null;
        },
      };
    },
    createRange() {
      let startNode;
      let startOffset;
      let endNode;
      let endOffset;
      return {
        setStart(node, offset) {
          startNode = node;
          startOffset = offset;
        },
        setEnd(node, offset) {
          endNode = node;
          endOffset = offset;
        },
        toString() {
          return fakeRangeString(
            rootRef.current,
            startNode,
            startOffset,
            endNode,
            endOffset,
          );
        },
      };
    },
  };
  return doc;
}

function fakeRangeString(root, startNode, startOffset, endNode, endOffset) {
  const nodes = flattenFakeTextNodes(root);
  let result = "";
  let active = false;
  for (const node of nodes) {
    if (node === startNode) active = true;
    if (!active) continue;
    const start = node === startNode ? startOffset : 0;
    const end = node === endNode ? endOffset : node.nodeValue.length;
    result += node.nodeValue.slice(start, end);
    if (node === endNode) break;
  }
  return result;
}

function flattenFakeTextNodes(root) {
  if (root.nodeType === 3) return [root];
  return root.childNodes.flatMap(flattenFakeTextNodes);
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
