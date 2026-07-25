importScripts("brand.js");

const {
  COLOR_STORAGE_KEY,
  DEFAULT_COLOR_ID,
  colorById,
  pngPaths,
} = globalThis.ANoteBrand;
const MAX_CAPTURE_DATA_URL_LENGTH = 48 * 1024 * 1024;

updateActionColor(DEFAULT_COLOR_ID).catch(() => {});
chrome.storage.local.get(COLOR_STORAGE_KEY)
  .then((stored) => updateActionColor(stored[COLOR_STORAGE_KEY]))
  .catch(() => updateActionColor(DEFAULT_COLOR_ID))
  .catch(() => {});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^(https?|file):/.test(tab.url || "")) return;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "ANOTE_TOGGLE_ACTIVE" });
    await updateBadge(tab.id, response?.active);
  } catch (_error) {
      // Pages that were already open when the extension was installed need a
      // one-time injection before they can receive the action click.
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["brand.js", "lib.js", "layout.js", "widget.js", "content.js"],
        });
      const response = await chrome.tabs.sendMessage(tab.id, { type: "ANOTE_TOGGLE_ACTIVE" });
      await updateBadge(tab.id, response?.active);
    } catch (_injectionError) {
      // Chrome-internal and restricted pages cannot host content scripts.
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") updateBadge(tabId, false);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[COLOR_STORAGE_KEY]) return;
  updateActionColor(changes[COLOR_STORAGE_KEY].newValue).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ANOTE_ACTIVE_CHANGED" && sender.tab?.id) {
    updateBadge(sender.tab.id, message.active);
    return undefined;
  }

  if (message?.type === "ANOTE_CAPTURE_SCREENSHOT") {
    captureScreenshot(sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return undefined;
});

async function captureScreenshot(sender) {
  if (!sender.tab?.id || !sender.tab.active) throw new Error("The annotated tab is not active");

  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {
    format: "jpeg",
    quality: 90,
  });
  if (
    typeof screenshotDataUrl !== "string"
    || !screenshotDataUrl.startsWith("data:image/jpeg;base64,")
  ) {
    throw new Error("Chrome returned an invalid screenshot");
  }
  if (screenshotDataUrl.length > MAX_CAPTURE_DATA_URL_LENGTH) {
    throw new Error("The captured screenshot is too large");
  }

  return { ok: true, screenshotDataUrl };
}

async function updateBadge(tabId, active) {
  await chrome.action.setBadgeText({ tabId, text: active ? "ON" : "" });
}

async function updateActionColor(colorId) {
  const color = colorById(colorId);
  const paths = pngPaths(color.id);
  const updates = [
    chrome.action.setIcon({
      path: {
        16: paths[16],
        24: paths[24],
        32: paths[32],
      },
    }),
    chrome.action.setBadgeBackgroundColor({ color: color.value }),
  ];
  if (typeof chrome.action.setBadgeTextColor === "function") {
    updates.push(chrome.action.setBadgeTextColor({ color: color.foreground }));
  }
  await Promise.all(updates);
}
