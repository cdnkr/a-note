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

  if (message?.type === "ANNOTATE_CREATE_SHARE") {
    createShare(message, sender)
      .then((share) => sendResponse({ ok: true, share }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "ANNOTATE_FETCH_SHARE") {
    fetchShare(message.shareId)
      .then((share) => sendResponse({ ok: true, share }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return undefined;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ANNOTATE_PING" || !isAllowedWebAppUrl(sender.url)) return false;
  sendResponse({
    ok: true,
    installed: true,
    version: chrome.runtime.getManifest().version,
  });
  return false;
});

async function createShare(message, sender) {
  if (!sender.tab?.id || !sender.tab.active) throw new Error("The annotated tab is not active");
  const targetUrl = normaliseTargetUrl(message.targetUrl);
  const xpath = boundedString(message.xpath, 4096, "XPath");
  const comment = boundedString(message.comment, 240, "Comment");

  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {
    format: "jpeg",
    quality: 90,
  });
  const screenshot = await (await fetch(screenshotDataUrl)).blob();
  const form = new FormData();
  form.set("targetUrl", targetUrl);
  form.set("xpath", xpath);
  form.set("comment", comment);
  form.set("screenshot", screenshot, "annotation.jpg");

  const response = await fetch(config.apiBaseUrl, {
    method: "POST",
    headers: { "X-Annotate-Client": "extension-v1" },
    body: form,
  });
  const payload = await readJson(response);
  if (!response.ok) throw new Error(payload?.error?.message || "Could not create the share link");
  if (!isShareId(payload.id)) throw new Error("The share service returned an invalid ID");

  return {
    shareId: payload.id,
    shareUrl: payload.shareUrl || sharePageUrl(config.webAppOrigin, payload.id),
    screenshotUrl: payload.screenshotUrl,
    sharedAt: new Date().toISOString(),
  };
}

async function fetchShare(shareId) {
  if (!isShareId(shareId)) throw new Error("Invalid share link");
  const response = await fetch(`${config.apiBaseUrl}/${encodeURIComponent(shareId)}`);
  const payload = await readJson(response);
  if (!response.ok) throw new Error(payload?.error?.message || "Share not found");

  return {
    ...payload,
    shareId,
    shareUrl: sharePageUrl(config.webAppOrigin, shareId),
  };
}

function isAllowedWebAppUrl(value) {
  try {
    const origin = new URL(value).origin;
    return config.allowedWebAppOrigins.includes(origin);
  } catch (_error) {
    return false;
  }
}

function normaliseTargetUrl(value) {
  const url = new URL(String(value));
  if (!/^https?:$/.test(url.protocol) || url.toString().length > 8192) {
    throw new Error("Invalid target URL");
  }
  return url.toString();
}

function boundedString(value, maxLength, label) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) throw new Error(`${label} is invalid`);
  return text;
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
