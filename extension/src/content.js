(function () {
  "use strict";

  if (window.top !== window || document.getElementById("a-extension-root")) return;

  const widget = globalThis.ANoteWidget.mount({
    hostId: "a-extension-root",
    environment: {
      assetUrl(path) {
        return chrome.runtime.getURL(path);
      },
      async loadAnnotations(pageKey) {
        const stored = await chrome.storage.local.get(pageKey);
        return Array.isArray(stored[pageKey]) ? stored[pageKey] : [];
      },
      saveAnnotations(pageKey, annotations) {
        return chrome.storage.local.set({ [pageKey]: annotations });
      },
      async loadColor() {
        const { COLOR_STORAGE_KEY, DEFAULT_COLOR_ID } = globalThis.ANoteBrand;
        const stored = await chrome.storage.local.get(COLOR_STORAGE_KEY);
        return typeof stored[COLOR_STORAGE_KEY] === "string"
          ? stored[COLOR_STORAGE_KEY]
          : DEFAULT_COLOR_ID;
      },
      saveColor(colorId) {
        const { COLOR_STORAGE_KEY } = globalThis.ANoteBrand;
        return chrome.storage.local.set({ [COLOR_STORAGE_KEY]: colorId });
      },
      loadManualPositions(pageKey) {
        const key = `a-note:manual-positions:${pageKey}`;
        try {
          return JSON.parse(window.localStorage.getItem(key) || "{}");
        } catch (_error) {
          return {};
        }
      },
      saveManualPositions(pageKey, positions) {
        const key = `a-note:manual-positions:${pageKey}`;
        try {
          window.localStorage.setItem(key, JSON.stringify(positions));
        } catch (_error) {
          // Dragging continues in memory when page storage is unavailable.
        }
      },
      async capture({ kind }) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: "ANOTE_CAPTURE_SCREENSHOT",
          });
          if (!response?.ok || !response.screenshotDataUrl) return response;

          const screenshotResponse = await fetch(response.screenshotDataUrl);
          const screenshotBlob = await screenshotResponse.blob();
          if (screenshotBlob.type !== "image/jpeg" || screenshotBlob.size === 0) {
            throw new Error("Chrome returned an invalid screenshot");
          }
          return {
            ok: true,
            file: new File([screenshotBlob], screenshotFileName(kind), {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          };
        } catch (error) {
          return {
            ok: false,
            error: error?.message || "Could not capture this viewport",
          };
        }
      },
      activeChanged(active) {
        chrome.runtime.sendMessage({ type: "ANOTE_ACTIVE_CHANGED", active }).catch(() => {});
      },
    },
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "ANOTE_TOGGLE_ACTIVE") {
      widget.toggle();
      sendResponse({ ok: true, ...widget.status() });
    }
    if (message?.type === "ANOTE_STATUS") {
      sendResponse({ ok: true, ...widget.status() });
    }
  });

  function screenshotFileName(kind) {
    const isSingleNote = kind === "note";
    const safeHostname = location.hostname
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${isSingleNote ? "a-" : ""}note${!isSingleNote ? "s" : ""}-on-${safeHostname || "a-page"}.jpg`;
  }
})();
