const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const extensionRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(extensionRoot, "src");
const brandSource = fs.readFileSync(path.join(sourceRoot, "brand.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(sourceRoot, "background.js"), "utf8");

test("background restores and globally updates the toolbar colour", async () => {
  const calls = {
    icons: [],
    badgeBackgrounds: [],
    badgeForegrounds: [],
    captures: [],
    fetches: 0,
  };
  let storageListener;
  let messageListener;
  const context = vm.createContext({
    importScripts() {},
    chrome: {
      action: {
        onClicked: { addListener() {} },
        async setIcon(details) { calls.icons.push(details); },
        async setBadgeBackgroundColor(details) { calls.badgeBackgrounds.push(details); },
        async setBadgeTextColor(details) { calls.badgeForegrounds.push(details); },
        async setBadgeText() {},
      },
      scripting: { async executeScript() {} },
      storage: {
        local: {
          async get() {
            return { "a-note:annotation-color": "teal" };
          },
        },
        onChanged: {
          addListener(listener) {
            storageListener = listener;
          },
        },
      },
      tabs: {
        onUpdated: { addListener() {} },
        async sendMessage() { return { active: false }; },
        async captureVisibleTab(windowId, options) {
          calls.captures.push({ windowId, options });
          return "data:image/jpeg;base64,anBlZw==";
        },
      },
      runtime: {
        onMessage: {
          addListener(listener) {
            messageListener = listener;
          },
        },
      },
    },
    Date,
    Error,
    Map,
    Object,
    Promise,
    String,
    URL,
    fetch() {
      calls.fetches += 1;
      throw new Error("Capture should not use the network");
    },
    globalThis: undefined,
  });
  context.globalThis = context;

  vm.runInContext(brandSource, context);
  vm.runInContext(backgroundSource, context);
  await settle();

  const restoredIcon = calls.icons.at(-1);
  assert.equal(restoredIcon.path[16], "icons/a-teal-16.png");
  assert.equal(restoredIcon.path[24], "icons/a-teal-24.png");
  assert.equal(restoredIcon.path[32], "icons/a-teal-32.png");
  assert.equal("tabId" in restoredIcon, false);
  assert.equal(calls.badgeBackgrounds.at(-1).color, "#0d9488");
  assert.equal(calls.badgeForegrounds.at(-1).color, "#ffffff");

  storageListener(
    { "a-note:annotation-color": { oldValue: "teal", newValue: "yellow" } },
    "local",
  );
  await settle();
  assert.equal(calls.icons.at(-1).path[16], "icons/a-yellow-16.png");
  assert.equal(calls.badgeBackgrounds.at(-1).color, "#facc15");
  assert.equal(calls.badgeForegrounds.at(-1).color, "#111a2e");

  storageListener(
    { "a-note:annotation-color": { oldValue: "yellow", newValue: "chartreuse" } },
    "local",
  );
  await settle();
  assert.equal(calls.icons.at(-1).path[16], "icons/a-cobalt-16.png");

  const capture = await new Promise((resolve) => {
    const keepChannelOpen = messageListener(
      { type: "ANOTE_CAPTURE_SCREENSHOT" },
      { tab: { id: 12, active: true, windowId: 34 } },
      resolve,
    );
    assert.equal(keepChannelOpen, true);
  });
  assert.equal(capture.ok, true);
  assert.equal(capture.screenshotDataUrl, "data:image/jpeg;base64,anBlZw==");
  assert.equal(calls.captures.length, 1);
  assert.equal(calls.captures[0].windowId, 34);
  assert.equal(calls.captures[0].options.format, "jpeg");
  assert.equal(calls.captures[0].options.quality, 90);
  assert.equal(calls.fetches, 0);
});

function settle() {
  return new Promise((resolve) => setImmediate(resolve));
}
