importScripts("config.js", "lib.js");

const { isShareId, sharePageUrl } = globalThis.AnnotateLib;
const config = globalThis.AnnotateConfig;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^(https?|file):/.test(tab.url || "")) return;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "ANNOTATE_TOGGLE_ACTIVE" });
    await updateBadge(tab.id, response?.active);
  } catch (_error) {
    // Pages that were already open when the extension was installed need a
    // one-time injection before they can receive the action click.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["config.js", "lib.js", "content.js"],
      });
      const response = await chrome.tabs.sendMessage(tab.id, { type: "ANNOTATE_TOGGLE_ACTIVE" });
      await updateBadge(tab.id, response?.active);
    } catch (_injectionError) {
      // Chrome-internal and restricted pages cannot host content scripts.
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") updateBadge(tabId, false);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ANNOTATE_ACTIVE_CHANGED" && sender.tab?.id) {
    updateBadge(sender.tab.id, message.active);
    return undefined;
  }

  if (message?.type === "ANNOTATE_CAPTURE_AND_CREATE_SHARE") {
    captureAndCreateShare(message, sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return undefined;
});

async function captureAndCreateShare(message, sender) {
  if (!sender.tab?.id || !sender.tab.active) throw new Error("The annotated tab is not active");
  const targetUrl = normaliseTargetUrl(message.targetUrl);

  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {
    format: "jpeg",
    quality: 90,
  });
  const screenshot = await (await fetch(screenshotDataUrl)).blob();
  const form = new FormData();
  form.set("targetUrl", targetUrl);
  try {
    form.set("screenshot", screenshot, "annotate-screenshot.jpg");
    const response = await fetch(config.apiBaseUrl, {
      method: "POST",
      headers: { "X-Annotate-Client": "extension-v1" },
      body: form,
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(payload?.error?.message || "Could not create the share link");
    if (!isShareId(payload.id)) throw new Error("The share service returned an invalid ID");

    return {
      ok: true,
      screenshotDataUrl,
      share: {
        shareId: payload.id,
        shareUrl: payload.shareUrl || sharePageUrl(config.webAppOrigin, payload.id),
        screenshotUrl: payload.screenshotUrl,
        sharedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      screenshotDataUrl,
      error: error?.message || "Could not create the share link",
    };
  }
}

function normaliseTargetUrl(value) {
  const url = new URL(String(value));
  if (!/^https?:$/.test(url.protocol) || url.toString().length > 8192) {
    throw new Error("Invalid target URL");
  }
  return url.toString();
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

async function updateBadge(tabId, active) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#405cf5" });
  await chrome.action.setBadgeText({ tabId, text: active ? "ON" : "" });
}
