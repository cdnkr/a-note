(function () {
  "use strict";

  if (window.top !== window || document.getElementById("annotate-extension-root")) return;

  const {
    MAX_CONTENT_LENGTH,
    pageUrl,
    xpathForElement,
  } = globalThis.AnnotateLib;

  const PAGE_COMMENT_MAX_WIDTH = 340;
  const COLOR_STORAGE_KEY = "annotate:annotation-color";
  const DEFAULT_COLOR_ID = "cobalt";
  const ANNOTATION_COLORS = [
    { id: "cobalt", label: "Cobalt", value: "#405cf5", foreground: "#ffffff" },
    { id: "indigo", label: "Indigo", value: "#4f46e5", foreground: "#ffffff" },
    { id: "violet", label: "Violet", value: "#7c3aed", foreground: "#ffffff" },
    { id: "purple", label: "Purple", value: "#9333ea", foreground: "#ffffff" },
    { id: "pink", label: "Pink", value: "#db2777", foreground: "#ffffff" },
    { id: "red", label: "Red", value: "#dc2626", foreground: "#ffffff" },
    { id: "orange", label: "Orange", value: "#f97316", foreground: "#111a2e" },
    { id: "yellow", label: "Yellow", value: "#facc15", foreground: "#111a2e" },
    { id: "lime", label: "Lime", value: "#84cc16", foreground: "#111a2e" },
    { id: "green", label: "Green", value: "#059669", foreground: "#ffffff" },
    { id: "teal", label: "Teal", value: "#0d9488", foreground: "#ffffff" },
    { id: "slate", label: "Slate", value: "#344054", foreground: "#ffffff" },
  ];

  const state = {
    annotations: [],
    active: false,
    annotating: false,
    composerTarget: null,
    sharingIds: new Set(),
    capturing: false,
    preview: null,
    colorId: DEFAULT_COLOR_ID,
    colorPickerOpen: false,
  };

  let pageKey = pageUrl(location.href);
  const host = document.createElement("div");
  host.id = "annotate-extension-root";
  host.setAttribute("data-annotate-ui", "true");
  host.style.setProperty("display", "none", "important");
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.append(host);
  const pageStyle = document.createElement("style");
  pageStyle.textContent = "html.annotate-is-selecting, html.annotate-is-selecting * { cursor: crosshair !important; }";
  document.documentElement.append(pageStyle);

  shadow.innerHTML = `
    <style>${styles()}</style>
    <div class="target-outline" aria-hidden="true"></div>
    <div class="pins" aria-label="Page annotations"></div>
    <section class="dock" aria-label="annotate">
      <section class="capture-preview" hidden aria-label="Captured screenshot">
        <button class="preview-close ghost-icon" type="button" aria-label="Close screenshot preview">${icon("close")}</button>
        <div class="preview-image-shell">
          <img class="preview-image" alt="Captured annotated viewport">
        </div>
        <div class="preview-actions">
          <button class="preview-share ghost-button" type="button">${icon("share")}<span>Share</span></button>
          <button class="preview-download ghost-button" type="button">${icon("download")}<span>Download</span></button>
        </div>
        <div class="preview-link">
          <span class="sr-only">Screenshot share link</span>
          <input type="text" readonly aria-label="Screenshot share link">
          <button class="preview-copy" type="button" aria-label="Copy screenshot link">${icon("copy")}<span>Copy</span></button>
        </div>
      </section>
      <section class="color-picker" hidden aria-label="Choose annotation colour">
        <button class="color-picker-close ghost-icon" type="button" aria-label="Close colour selector">${icon("close")}</button>
        <h3>Note colour</h3>
        <div class="color-grid" role="radiogroup" aria-label="Annotation colour">
          ${colorOptionsMarkup()}
        </div>
      </section>
      <div class="toolbar">
        <span class="brand-mark" aria-hidden="true">A</span>
        <button class="toolbar-action screenshot-button" type="button" aria-label="Capture viewport" title="Capture viewport">
          ${icon("screenshot")}
        </button>
        <button class="color-button" type="button" aria-label="Choose annotation colour" title="Choose annotation colour" aria-expanded="false"></button>
        <button class="toolbar-action start-button" type="button" aria-label="Add annotation" title="Add annotation" aria-pressed="false">
          ${icon("plus")}
        </button>
        <button class="toolbar-action close-mode" type="button" aria-label="Close annotate mode" title="Close annotate mode">
          ${icon("close")}
        </button>
      </div>
    </section>
    <section class="composer" hidden role="dialog" aria-label="Add annotation">
      <textarea id="annotate-comment" maxlength="${MAX_CONTENT_LENGTH}" placeholder="Add a short comment…"></textarea>
      <div class="composer-foot">
        <button class="composer-close" type="button" aria-label="Cancel new annotation">${icon("close")}</button>
        <button class="save-button" type="button" aria-label="Save annotation" disabled>${icon("up")}</button>
      </div>
    </section>
    <div class="toast" role="status" aria-live="polite"></div>
  `;

  const ui = {
    outline: shadow.querySelector(".target-outline"),
    pins: shadow.querySelector(".pins"),
    dock: shadow.querySelector(".dock"),
    screenshotButton: shadow.querySelector(".screenshot-button"),
    closeMode: shadow.querySelector(".close-mode"),
    startButton: shadow.querySelector(".start-button"),
    preview: shadow.querySelector(".capture-preview"),
    previewImage: shadow.querySelector(".preview-image"),
    previewClose: shadow.querySelector(".preview-close"),
    previewShare: shadow.querySelector(".preview-share"),
    previewDownload: shadow.querySelector(".preview-download"),
    previewLink: shadow.querySelector(".preview-link input"),
    previewCopy: shadow.querySelector(".preview-copy"),
    colorPicker: shadow.querySelector(".color-picker"),
    colorPickerClose: shadow.querySelector(".color-picker-close"),
    colorGrid: shadow.querySelector(".color-grid"),
    colorButton: shadow.querySelector(".color-button"),
    composer: shadow.querySelector(".composer"),
    composerClose: shadow.querySelector(".composer-close"),
    textarea: shadow.querySelector("textarea"),
    saveButton: shadow.querySelector(".save-button"),
    toast: shadow.querySelector(".toast"),
  };

  let hostHideTimer;
  let composerHideTimer;
  let previewHideTimer;
  let colorPickerHideTimer;

  bindUi();
  initialise();

  async function initialise() {
    const [annotations, colorId] = await Promise.all([
      loadAnnotations(),
      loadAnnotationColor(),
    ]);
    state.annotations = annotations;
    applyAnnotationColor(colorId, false);
    render();
  }

  function bindUi() {
    ui.closeMode.addEventListener("click", () => setActive(false));
    ui.screenshotButton.addEventListener("click", captureViewportShare);
    ui.startButton.addEventListener("click", () => {
      if (!state.annotating && state.composerTarget) closeComposer();
      setAnnotating(!state.annotating);
    });
    ui.previewClose.addEventListener("click", closePreview);
    ui.previewShare.addEventListener("click", sharePreview);
    ui.previewDownload.addEventListener("click", downloadPreview);
    ui.previewCopy.addEventListener("click", copyPreviewLink);
    ui.previewLink.addEventListener("focus", () => ui.previewLink.select());
    ui.colorButton.addEventListener("click", () => setColorPickerOpen(!state.colorPickerOpen));
    ui.colorPickerClose.addEventListener("click", () => setColorPickerOpen(false));
    ui.colorGrid.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("[data-color-id]");
      if (button) applyAnnotationColor(button.dataset.colorId);
    });
    ui.composerClose.addEventListener("click", closeComposer);
    ui.textarea.addEventListener("input", () => {
      ui.saveButton.disabled = ui.textarea.value.trim().length === 0;
      resizeComposerTextarea();
    });
    ui.textarea.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") saveComposer();
      if (event.key === "Escape") closeComposer();
    });
    ui.saveButton.addEventListener("click", saveComposer);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onPageClick, true);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (state.colorPickerOpen) {
        setColorPickerOpen(false);
      } else if (state.annotating) {
        setAnnotating(false);
      }
    }, true);
    window.addEventListener("scroll", positionAnchoredUi, { passive: true });
    document.addEventListener("scroll", positionAnchoredUi, { capture: true, passive: true });
    window.addEventListener("resize", positionAnchoredUi, { passive: true });
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    window.setInterval(handleUrlChange, 1000);
    window.setInterval(refreshResolvedTargets, 1500);

    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === "ANNOTATE_TOGGLE_ACTIVE") {
          setActive(!state.active);
          sendResponse({ ok: true, active: state.active });
        }
        if (message?.type === "ANNOTATE_STATUS") {
          sendResponse({ ok: true, count: state.annotations.length, url: pageKey });
        }
      });
    }
  }

  async function handleUrlChange() {
    const nextPageKey = pageUrl(location.href);
    if (nextPageKey === pageKey) return;

    pageKey = nextPageKey;
    state.annotations = await loadAnnotations();
    closeComposer();
    closePreview();
    setColorPickerOpen(false);
    setAnnotating(false);
    render();
  }

  function refreshResolvedTargets() {
    if (!state.active) return;
    const expected = new Set(
      state.annotations
        .map((annotation) => resolveElement(annotation.xpath))
        .filter(Boolean),
    ).size;
    const rendered = ui.pins.querySelectorAll(".annotation-stack").length;
    if (expected !== rendered) {
      render();
      return;
    }
    positionAnchoredUi();
  }

  function setActive(active) {
    state.active = active;
    clearTimeout(hostHideTimer);
    chrome.runtime.sendMessage({ type: "ANNOTATE_ACTIVE_CHANGED", active }).catch(() => {});
    if (!active) {
      setAnnotating(false);
      closeComposer();
      closePreview();
      setColorPickerOpen(false);
      ui.dock.classList.remove("is-visible");
      const annotationExitDuration = playAnnotationExit();
      hostHideTimer = setTimeout(() => {
        if (!state.active) host.style.setProperty("display", "none", "important");
      }, Math.max(300, annotationExitDuration + 40));
      return;
    }

    host.style.setProperty("display", "block", "important");
    ui.pins.classList.remove("is-exiting");
    render();
    requestAnimationFrame(() => {
      if (state.active) ui.dock.classList.add("is-visible");
    });
  }

  function playAnnotationExit() {
    const comments = [...ui.pins.querySelectorAll(".page-comment-row")];
    if (!comments.length) return 0;

    ui.pins.classList.add("is-exiting");
    comments.forEach((comment, index) => {
      const reverseDelay = (comments.length - index - 1) * 50;
      comment.style.setProperty("--exit-delay", `${reverseDelay}ms`);
      comment.classList.add("is-exiting");
    });

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
    return (comments.length - 1) * 50 + 220;
  }

  function setAnnotating(active, preserveComposer = false) {
    state.annotating = active;
    document.documentElement.classList.toggle("annotate-is-selecting", active);
    ui.startButton.classList.toggle("is-active", active);
    ui.startButton.setAttribute("aria-pressed", String(active));
    ui.startButton.setAttribute("aria-label", active ? "Stop adding annotations" : "Add annotation");
    ui.startButton.title = active ? "Stop adding annotations" : "Add annotation";
    ui.outline.style.display = "none";
    if (active) {
      showToast("Select an element to annotate");
    } else if (!preserveComposer) {
      closeComposer();
    }
  }

  function onPointerMove(event) {
    if (!state.annotating || isExtensionUi(event)) return;
    const target = event.target;
    if (!(target instanceof Element) || target === document.documentElement || target === document.body) return;
    const rect = target.getBoundingClientRect();
    Object.assign(ui.outline.style, {
      display: "block",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  function onPageClick(event) {
    if (!state.annotating || isExtensionUi(event)) return;
    const target = event.target;
    if (!(target instanceof Element) || target === document.documentElement || target === document.body) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    state.composerTarget = target;
    setAnnotating(false, true);
    openComposer();
  }

  function isExtensionUi(event) {
    return event.composedPath().includes(host);
  }

  function openComposer() {
    clearTimeout(composerHideTimer);
    ui.composer.hidden = false;
    ui.textarea.value = "";
    ui.textarea.style.height = "126px";
    ui.saveButton.disabled = true;
    positionComposer();
    requestAnimationFrame(() => {
      if (state.composerTarget) {
        ui.composer.classList.add("is-visible");
        ui.textarea.focus();
      }
    });
  }

  function positionComposer() {
    if (ui.composer.hidden || !state.composerTarget?.isConnected) return;
    const rect = state.composerTarget.getBoundingClientRect();
    Object.assign(ui.outline.style, {
      display: "block",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    const stackWidth = pageCommentStackWidth();
    const width = stackWidth;
    const existingAnnotation = state.annotations.find(
      (annotation) => resolveElement(annotation.xpath) === state.composerTarget,
    );
    const existingStack = existingAnnotation
      ? ui.pins.querySelector(`[data-anchor="${cssEscape(existingAnnotation.id)}"]`)
      : null;
    const placement = annotationPlacement(rect, stackWidth);
    placement.left += placement.side === "left" ? stackWidth - width : 0;

    if (existingStack && !existingStack.hidden) {
      const existingComment = existingStack.querySelector(".page-comment");
      const commentRect = existingComment?.getBoundingClientRect();
      const stackTop = Number.parseFloat(existingStack.style.top);
      if (commentRect && Number.isFinite(stackTop)) {
        placement.left = commentRect.left + window.scrollX;
        placement.top = stackTop + existingStack.offsetHeight + 7;
      }
    }
    Object.assign(ui.composer.style, {
      width: `${width}px`,
      left: `${placement.left}px`,
      top: `${placement.top}px`,
    });
  }

  function resizeComposerTextarea() {
    ui.textarea.style.height = "auto";
    ui.textarea.style.height = `${Math.min(Math.max(ui.textarea.scrollHeight, 126), 240)}px`;
    positionComposer();
  }

  function closeComposer() {
    clearTimeout(composerHideTimer);
    ui.composer.classList.remove("is-visible");
    ui.outline.style.display = "none";
    state.composerTarget = null;
    composerHideTimer = setTimeout(() => {
      if (!state.composerTarget) ui.composer.hidden = true;
    }, 180);
  }

  async function saveComposer() {
    const content = ui.textarea.value.trim().slice(0, MAX_CONTENT_LENGTH);
    if (!content || !state.composerTarget) return;
    const annotation = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      xpath: xpathForElement(state.composerTarget),
      content,
      createdAt: new Date().toISOString(),
    };
    state.annotations.push(annotation);
    await saveAnnotations();
    closeComposer();
    render();
    showToast("Annotation saved");
  }

  async function deleteAnnotation(id) {
    state.annotations = state.annotations.filter((item) => item.id !== id);
    await saveAnnotations();
    render();
    showToast("Annotation removed");
  }

  async function shareAnnotation(annotation) {
    if (!annotation || state.capturing || state.sharingIds.has(annotation.id)) return;
    if (annotation.shareUrl && annotation.screenshotUrl) {
      openPreview({
        imageUrl: annotation.screenshotUrl,
        shareUrl: annotation.shareUrl,
        kind: "note",
      });
      return;
    }
    const element = resolveElement(annotation.xpath);
    if (!element) {
      showToast("Element not found — screenshot unavailable");
      return;
    }

    state.sharingIds.add(annotation.id);
    setPageShareButtonState(annotation.id, true);
    try {
      await enterNoteCaptureMode(element, annotation.id);
      const response = await createScreenshotShare();
      if (!response?.ok || !response.share?.shareUrl) {
        if (response?.screenshotDataUrl) {
          openPreview({ imageUrl: response.screenshotDataUrl, shareUrl: "", kind: "note" });
        }
        throw new Error(response?.error || "Could not create share link");
      }
      Object.assign(annotation, response.share);
      await saveAnnotations();
      openPreview({
        imageUrl: response.screenshotDataUrl || annotation.screenshotUrl,
        shareUrl: annotation.shareUrl,
        kind: "note",
      });
    } catch (error) {
      showToast(error?.message || "Could not create share link");
    } finally {
      exitCaptureMode();
      state.sharingIds.delete(annotation.id);
      setPageShareButtonState(annotation.id, false);
    }
  }

  async function captureViewportShare() {
    if (state.capturing) return;
    try {
      await enterViewportCaptureMode();
      const response = await createScreenshotShare();
      const imageUrl = response?.screenshotDataUrl || response?.share?.screenshotUrl;
      if (imageUrl) {
        openPreview({
          imageUrl,
          shareUrl: response?.ok ? response.share?.shareUrl || "" : "",
          kind: "viewport",
        });
      }
      if (!response?.ok || !response.share?.shareUrl) {
        throw new Error(response?.error || "Could not create share link");
      }
    } catch (error) {
      showToast(error?.message || "Could not capture this viewport");
    } finally {
      exitCaptureMode();
    }
  }

  function createScreenshotShare() {
    return chrome.runtime.sendMessage({
      type: "ANNOTATE_CAPTURE_AND_CREATE_SHARE",
      targetUrl: pageKey,
    });
  }

  function setPageShareButtonState(id, sharing) {
    const button = ui.pins.querySelector(`[data-page-share="${cssEscape(id)}"]`);
    if (!button) return;
    button.disabled = sharing || state.capturing;
    button.setAttribute("aria-busy", String(sharing));
  }

  async function enterNoteCaptureMode(element, annotationId) {
    setCaptureBusy(true);
    clearCaptureTargets();
    const comment = ui.pins.querySelector(`[data-page-comment="${cssEscape(annotationId)}"]`);
    const commentRow = comment?.closest(".page-comment-row");
    const stack = commentRow?.closest(".annotation-stack");
    commentRow?.classList.add("is-capture-target");
    stack?.classList.add("is-capture-target");
    host.classList.add("is-capturing", "is-capturing-note");
    positionPins();
    await waitForCaptureFade();

    const rect = element.getBoundingClientRect();
    const commentRect = comment?.getBoundingClientRect();
    const margin = 12;
    if (!isCaptureRectVisible(rect, margin) || !isCaptureRectVisible(commentRect, margin)) {
      element.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
      await nextPaint();
      positionPins();
      await nextPaint();
    }

    const captureRect = element.getBoundingClientRect();
    Object.assign(ui.outline.style, {
      display: "block",
      left: `${captureRect.left}px`,
      top: `${captureRect.top}px`,
      width: `${captureRect.width}px`,
      height: `${captureRect.height}px`,
    });
    await nextPaint();
  }

  async function enterViewportCaptureMode() {
    setCaptureBusy(true);
    clearCaptureTargets();
    ui.outline.style.display = "none";
    host.classList.add("is-capturing", "is-capturing-viewport");
    positionPins();
    await waitForCaptureFade();
  }

  function exitCaptureMode() {
    host.classList.remove("is-capturing", "is-capturing-note", "is-capturing-viewport");
    clearCaptureTargets();
    setCaptureBusy(false);
    ui.outline.style.display = state.composerTarget ? "block" : "none";
    positionAnchoredUi();
  }

  function setCaptureBusy(busy) {
    state.capturing = busy;
    ui.screenshotButton.disabled = busy;
    ui.screenshotButton.setAttribute("aria-busy", String(busy));
    ui.colorButton.disabled = busy;
    ui.startButton.disabled = busy;
    ui.pins.querySelectorAll("[data-page-share]").forEach((button) => {
      button.disabled = busy || state.sharingIds.has(button.dataset.pageShare);
    });
  }

  function clearCaptureTargets() {
    ui.pins.querySelectorAll(".is-capture-target").forEach((element) => {
      element.classList.remove("is-capture-target");
    });
  }

  function isCaptureRectVisible(rect, margin) {
    if (!rect) return false;
    return rect.top >= margin
      && rect.left >= margin
      && rect.bottom <= window.innerHeight - margin
      && rect.right <= window.innerWidth - margin;
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function waitForCaptureFade() {
    await nextPaint();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    await new Promise((resolve) => setTimeout(resolve, 220));
  }

  function setColorPickerOpen(open) {
    state.colorPickerOpen = open;
    clearTimeout(colorPickerHideTimer);
    ui.colorButton.classList.toggle("is-active", open);
    ui.colorButton.setAttribute("aria-expanded", String(open));
    if (open) {
      ui.colorPicker.hidden = false;
      requestAnimationFrame(() => {
        if (state.colorPickerOpen) ui.colorPicker.classList.add("is-visible");
      });
      return;
    }

    ui.colorPicker.classList.remove("is-visible");
    colorPickerHideTimer = setTimeout(() => {
      if (!state.colorPickerOpen) ui.colorPicker.hidden = true;
    }, 180);
  }

  function applyAnnotationColor(colorId, persist = true) {
    const color = ANNOTATION_COLORS.find((option) => option.id === colorId)
      || ANNOTATION_COLORS.find((option) => option.id === DEFAULT_COLOR_ID);
    if (!color) return;
    const lightForeground = color.foreground === "#ffffff";
    state.colorId = color.id;
    host.style.setProperty("--annotation-color", color.value);
    host.style.setProperty("--annotation-fg", color.foreground);
    host.style.setProperty("--annotation-outline", colorWithAlpha(color.value, .68));
    host.style.setProperty("--annotation-tint", colorWithAlpha(color.value, .075));
    host.style.setProperty("--annotation-halo", colorWithAlpha(color.value, .14));
    host.style.setProperty("--annotation-action-color", lightForeground ? "rgba(255,255,255,.82)" : "rgba(17,26,46,.78)");
    host.style.setProperty("--annotation-action-bg", lightForeground ? "rgba(255,255,255,.11)" : "rgba(17,26,46,.09)");
    host.style.setProperty("--annotation-action-hover", lightForeground ? "rgba(255,255,255,.22)" : "rgba(17,26,46,.16)");
    host.style.setProperty("--annotation-action-focus", lightForeground ? "rgba(255,255,255,.75)" : "rgba(17,26,46,.68)");
    ui.colorButton.style.backgroundColor = color.value;
    ui.colorButton.setAttribute("aria-label", `Choose annotation colour. Current colour: ${color.label}`);
    ui.colorButton.title = `Annotation colour: ${color.label}`;
    ui.colorGrid.querySelectorAll("[data-color-id]").forEach((button) => {
      const active = button.dataset.colorId === color.id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });
    if (persist) {
      chrome.storage.local.set({ [COLOR_STORAGE_KEY]: color.id }).catch(() => {});
    }
  }

  function colorWithAlpha(hex, alpha) {
    const value = Number.parseInt(hex.slice(1), 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return `rgba(${red},${green},${blue},${alpha})`;
  }

  function openPreview(preview) {
    clearTimeout(previewHideTimer);
    state.preview = preview;
    ui.previewImage.src = preview.imageUrl;
    ui.previewLink.value = preview.shareUrl;
    const linkUnavailable = !preview.shareUrl;
    ui.previewShare.disabled = linkUnavailable;
    ui.previewCopy.disabled = linkUnavailable;
    ui.previewLink.disabled = linkUnavailable;
    ui.previewLink.placeholder = linkUnavailable ? "Share link unavailable" : "";
    ui.preview.hidden = false;
    requestAnimationFrame(() => {
      if (state.preview === preview) ui.preview.classList.add("is-visible");
    });
  }

  function closePreview() {
    clearTimeout(previewHideTimer);
    state.preview = null;
    ui.preview.classList.remove("is-visible");
    previewHideTimer = setTimeout(() => {
      if (!state.preview) {
        ui.preview.hidden = true;
        ui.previewImage.removeAttribute("src");
        ui.previewLink.value = "";
      }
    }, 180);
  }

  async function sharePreview() {
    const shareUrl = state.preview?.shareUrl;
    if (!shareUrl) return;
    try {
      const shareData = {
        title: document.title || "Annotated screenshot",
        text: "Shared with Annotate",
        url: shareUrl,
      };
      const canShare = typeof navigator.share === "function"
        && (typeof navigator.canShare !== "function" || navigator.canShare(shareData));
      if (canShare) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      await copyText(shareUrl);
      showToast("Share link copied");
    } catch (_error) {
      showToast("Could not share screenshot");
    }
  }

  async function copyPreviewLink() {
    const shareUrl = state.preview?.shareUrl;
    if (!shareUrl) return;
    try {
      await copyText(shareUrl);
      showToast("Share link copied");
    } catch (_error) {
      showToast("Could not copy share link");
    }
  }

  async function downloadPreview() {
    const preview = state.preview;
    if (!preview?.imageUrl) return;
    try {
      let href = preview.imageUrl;
      let objectUrl = "";
      if (!href.startsWith("data:")) {
        const response = await fetch(href, { credentials: "omit" });
        if (!response.ok) throw new Error("Screenshot download failed");
        objectUrl = URL.createObjectURL(await response.blob());
        href = objectUrl;
      }
      const link = document.createElement("a");
      const hostName = new URL(pageKey).hostname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      link.href = href;
      link.download = `annotate-${preview.kind}-${hostName || "page"}.jpg`;
      shadow.append(link);
      link.click();
      link.remove();
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      showToast(error?.message || "Could not download screenshot");
    }
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch (_error) {
      const input = document.createElement("textarea");
      input.value = value;
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
  }

  function resolveElement(xpath) {
    try {
      return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (_error) {
      return null;
    }
  }

  function render() {
    renderPins();
  }

  function renderPins() {
    const groups = new Map();
    let revealIndex = 0;
    state.annotations.forEach((annotation, index) => {
      const element = resolveElement(annotation.xpath);
      if (!element) return;
      if (!groups.has(element)) groups.set(element, []);
      groups.get(element).push({ annotation, number: index + 1 });
    });

    ui.pins.innerHTML = [...groups.values()].map((items) => {
      const anchorId = items[0].annotation.id;
      const comments = items.map(({ annotation }) => {
        const revealDelay = revealIndex * 50;
        const sharing = state.sharingIds.has(annotation.id);
        revealIndex += 1;
        return `
        <div class="page-comment-row" style="--reveal-delay: ${revealDelay}ms">
          <article class="page-comment" data-page-comment="${escapeHtml(annotation.id)}">
            <span class="page-comment-copy">${escapeHtml(annotation.content)}</span>
            <span class="page-comment-actions">
              <button class="page-comment-action page-comment-share" type="button" data-page-share="${escapeHtml(annotation.id)}" aria-label="Share annotation" title="Share annotation" aria-busy="${sharing}" ${sharing ? "disabled" : ""}>${icon("share")}</button>
              <button class="page-comment-action page-comment-delete" type="button" data-page-delete="${escapeHtml(annotation.id)}" aria-label="Delete annotation" title="Delete annotation">${icon("trash")}</button>
            </span>
          </article>
        </div>`;
      }).join("");
      return `<div class="element-highlight" data-highlight="${escapeHtml(anchorId)}" aria-hidden="true"></div><div class="annotation-stack" data-anchor="${escapeHtml(anchorId)}">${comments}</div>`;
    }).join("");

    ui.pins.querySelectorAll("[data-page-share]").forEach((button) => {
      button.addEventListener("click", () => shareAnnotation(findAnnotation(button.dataset.pageShare)));
    });
    ui.pins.querySelectorAll("[data-page-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteAnnotation(button.dataset.pageDelete));
    });
    positionPins();
  }

  function annotationPlacement(rect, width) {
    let left;
    let top = rect.top;
    let side;
    if (rect.right + width + 12 <= window.innerWidth) {
      left = rect.right + 10;
      side = "right";
    } else if (rect.left - width - 12 >= 0) {
      left = rect.left - width - 10;
      side = "left";
    } else {
      left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      top = rect.bottom + 8;
      side = "below";
    }
    return {
      left: left + window.scrollX,
      top: top + window.scrollY,
      side,
    };
  }

  function pageCommentStackWidth() {
    return Math.min(PAGE_COMMENT_MAX_WIDTH, window.innerWidth - 16);
  }

  function positionPins() {
    if (!state.active) return;
    ui.pins.querySelectorAll(".annotation-stack").forEach((stack) => {
      const annotation = findAnnotation(stack.dataset.anchor);
      const element = annotation && resolveElement(annotation.xpath);
      const highlight = ui.pins.querySelector(`[data-highlight="${cssEscape(stack.dataset.anchor)}"]`);
      if (!element) {
        stack.hidden = true;
        if (highlight) highlight.hidden = true;
        return;
      }
      const rect = element.getBoundingClientRect();
      const outsideViewport = rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth;
      stack.hidden = outsideViewport;
      if (highlight) {
        highlight.hidden = outsideViewport;
        highlight.style.left = `${rect.left + window.scrollX}px`;
        highlight.style.top = `${rect.top + window.scrollY}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
      }
      if (outsideViewport) return;

      const width = pageCommentStackWidth();
      const placement = annotationPlacement(rect, width);
      stack.dataset.placement = placement.side;
      stack.style.width = `${width}px`;
      stack.style.left = `${placement.left}px`;
      stack.style.top = `${placement.top}px`;
    });
  }

  function positionAnchoredUi() {
    positionPins();
    positionComposer();
  }

  function findAnnotation(id) {
    return state.annotations.find((annotation) => annotation.id === id);
  }

  async function loadAnnotations() {
    try {
      const stored = await chrome.storage.local.get(pageKey);
      return Array.isArray(stored[pageKey]) ? stored[pageKey] : [];
    } catch (_error) {
      return [];
    }
  }

  async function loadAnnotationColor() {
    try {
      const stored = await chrome.storage.local.get(COLOR_STORAGE_KEY);
      return typeof stored[COLOR_STORAGE_KEY] === "string"
        ? stored[COLOR_STORAGE_KEY]
        : DEFAULT_COLOR_ID;
    } catch (_error) {
      return DEFAULT_COLOR_ID;
    }
  }

  async function saveAnnotations() {
    await chrome.storage.local.set({ [pageKey]: state.annotations });
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2200);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cssEscape(value) {
    if (globalThis.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function colorOptionsMarkup() {
    return ANNOTATION_COLORS.map((color) => `
      <button
        class="color-swatch"
        type="button"
        role="radio"
        aria-checked="false"
        aria-label="${escapeHtml(color.label)}"
        title="${escapeHtml(color.label)}"
        data-color-id="${escapeHtml(color.id)}"
        style="--swatch-color: ${escapeHtml(color.value)}"
      ></button>
    `).join("");
  }

  function icon(name) {
    const icons = {
      spark: '<svg viewBox="0 0 24 24"><path d="M12 2l1.55 5.45L19 9l-5.45 1.55L12 16l-1.55-5.45L5 9l5.45-1.55L12 2Z"/><path d="m18.5 14 .8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8.8-2.7Z"/></svg>',
      plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
      close: '<svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg>',
      up: '<svg viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>',
      link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
      share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4m-7.6 6.8 7.6 4.4"/></svg>',
      screenshot: '<svg viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h2m8 0h2a2 2 0 0 1 2 2v2m0 8v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><rect x="7" y="8" width="10" height="8" rx="2"/><circle cx="12" cy="12" r="2"/></svg>',
      download: '<svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/></svg>',
      copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
      trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4m0 3h.01"/></svg>',
      cursor: '<svg viewBox="0 0 24 24"><path d="m5 3 14 9-6 1-3 6L5 3Z"/></svg>',
    };
    return icons[name] || "";
  }

  function styles() {
    return `
      :host { all: initial; --navy: #111a2e; --ink: #222b3e; --muted: #667085; --blue: #405cf5; --blue-dark: #2e48e8; --blue-pale: #edf3ff; --pink: #fff1f3; --line: #e7eaf0; --ink-black: #000000; --snow: #ffffff; --canvas: #f8f8f8; --fog: #efefef; --pebble: #d9d9d9; --graphite: #636363; --slate: #959595; --steel: #aeaeae; --ash: #7c7c7c; --annotation-color: #405cf5; --annotation-fg: #ffffff; --annotation-outline: rgba(64,92,245,.68); --annotation-tint: rgba(64,92,245,.075); --annotation-halo: rgba(64,92,245,.14); --annotation-action-color: rgba(255,255,255,.82); --annotation-action-bg: rgba(255,255,255,.11); --annotation-action-hover: rgba(255,255,255,.22); --annotation-action-focus: rgba(255,255,255,.75); font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--navy); }
      *, *::before, *::after { box-sizing: border-box; }
      button, textarea { font: inherit; }
      button { color: inherit; }
      svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      .dock { position: fixed; z-index: 2147483645; right: 22px; bottom: 22px; width: 360px; opacity: 0; transform: translateX(calc(100% + 32px)); transition: transform .28s cubic-bezier(.22, 1, .36, 1), opacity .18s ease; filter: drop-shadow(0 18px 40px rgba(20, 29, 50, .16)); }
      .dock.is-visible { opacity: 1; transform: translateX(0); }
      .toolbar { width: max-content; min-height: 68px; margin-left: auto; padding: 12px; border: 1px solid rgba(17,26,46,.08); background: #fff; border-radius: 18px; display: flex; align-items: center; gap: 8px; box-shadow: 0 3px 12px rgba(20,29,50,.07); transition: opacity .18s ease; }
      .brand-mark { width: 42px; height: 42px; border-radius: 12px 12px 12px 3px; display: grid; place-items: center; background: var(--annotation-color); color: var(--annotation-fg); font-size: 18px; font-weight: 850; line-height: 1; transition: background .16s ease, color .16s ease; }
      .toolbar-action { flex: 0 0 auto; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--ash); display: grid; place-items: center; cursor: pointer; transition: transform .16s ease, background .16s ease, color .16s ease; }
      .toolbar-action:hover:not(:disabled) { background: var(--fog); color: var(--ink-black); transform: translateY(-1px); }
      .toolbar-action:focus-visible, .ghost-icon:focus-visible, .ghost-button:focus-visible, .preview-copy:focus-visible { outline: 2px solid rgba(64,92,245,.34); outline-offset: 2px; }
      .toolbar-action:disabled { opacity: .48; cursor: wait; }
      .color-button { flex: 0 0 auto; width: 28px; height: 28px; padding: 0; border: 2px solid var(--snow); border-radius: 50%; background: var(--annotation-color); cursor: pointer; box-shadow: 0 0 0 1px rgba(17,26,46,.14), 0 4px 10px rgba(17,26,46,.12); transition: transform .16s ease, box-shadow .16s ease, background .16s ease; }
      .color-button:hover:not(:disabled) { transform: translateY(-1px) scale(1.04); box-shadow: 0 0 0 2px rgba(17,26,46,.18), 0 6px 13px rgba(17,26,46,.15); }
      .color-button:focus-visible, .color-button.is-active { outline: none; box-shadow: 0 0 0 3px var(--snow), 0 0 0 5px var(--navy); }
      .color-button:disabled { opacity: .48; cursor: wait; }
      .start-button.is-active { background: var(--navy); color: var(--snow); box-shadow: 0 5px 12px rgba(17,26,46,.22); }
      .start-button.is-active:hover:not(:disabled) { background: #050a15; color: var(--snow); }
      .capture-preview, .color-picker { position: relative; width: 100%; margin-bottom: 10px; padding: 10px; overflow: hidden; border: 1px solid rgba(17,26,46,.08); border-radius: 20px; background: var(--snow); opacity: 0; transform: translateY(8px) scale(.99); transition: opacity .18s ease, transform .2s cubic-bezier(.22, 1, .36, 1); box-shadow: 0 16px 44px rgba(17,26,46,.16); }
      .capture-preview.is-visible, .color-picker.is-visible { opacity: 1; transform: translateY(0) scale(1); }
      .preview-image-shell { overflow: hidden; min-height: 132px; max-height: min(280px, 42vh); border-radius: 13px; display: grid; place-items: center; background: var(--fog); }
      .preview-image { display: block; width: 100%; height: auto; max-height: min(280px, 42vh); object-fit: contain; }
      .ghost-icon { width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.88); color: var(--graphite); cursor: pointer; box-shadow: 0 3px 10px rgba(17,26,46,.12); }
      .preview-close { position: absolute; z-index: 2; top: 17px; right: 17px; }
      .ghost-icon:hover { background: var(--snow); color: var(--ink-black); }
      .preview-actions { display: flex; gap: 8px; padding: 10px 1px 8px; }
      .ghost-button { min-height: 34px; padding: 0 11px; border: 0; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; background: var(--canvas); color: var(--graphite); font-size: 10px; font-weight: 750; cursor: pointer; }
      .ghost-button:hover:not(:disabled) { background: var(--fog); color: var(--ink-black); }
      .ghost-button:disabled { opacity: .46; cursor: not-allowed; }
      .ghost-button svg { width: 15px; height: 15px; }
      .preview-link { position: relative; display: block; }
      .preview-link input { width: 100%; height: 42px; padding: 0 76px 0 12px; border: 1px solid var(--line); border-radius: 12px; outline: none; background: var(--canvas); color: var(--graphite); font: 600 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; }
      .preview-link input:focus { border-color: rgba(64,92,245,.45); box-shadow: 0 0 0 3px rgba(64,92,245,.10); }
      .preview-link input:disabled { color: var(--ash); }
      .preview-copy { position: absolute; right: 5px; top: 5px; height: 32px; padding: 0 9px; border: 0; border-radius: 9px; display: inline-flex; align-items: center; gap: 5px; background: var(--snow); color: var(--graphite); font-size: 9px; font-weight: 800; cursor: pointer; box-shadow: 0 2px 8px rgba(17,26,46,.08); }
      .preview-copy:hover:not(:disabled) { color: var(--ink-black); }
      .preview-copy:disabled { opacity: .45; cursor: not-allowed; }
      .preview-copy svg { width: 14px; height: 14px; }
      .color-picker { min-height: 188px; padding: 18px; }
      .color-picker h3 { margin: 0 42px 18px 1px; color: var(--ink-black); font-size: 13px; font-weight: 750; letter-spacing: -.15px; }
      .color-picker-close { position: absolute; z-index: 2; top: 12px; right: 12px; box-shadow: none; background: var(--canvas); }
      .color-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
      .color-swatch { width: 100%; aspect-ratio: 1.55; min-height: 36px; padding: 0; border: 3px solid transparent; border-radius: 12px; background: var(--swatch-color); cursor: pointer; box-shadow: inset 0 0 0 1px rgba(17,26,46,.08), 0 4px 10px rgba(17,26,46,.08); transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
      .color-swatch:hover { transform: translateY(-1px); box-shadow: inset 0 0 0 1px rgba(17,26,46,.08), 0 7px 14px rgba(17,26,46,.13); }
      .color-swatch.is-active { border-color: var(--navy); box-shadow: 0 0 0 2px var(--snow), 0 0 0 3px rgba(17,26,46,.16); }
      .color-swatch:focus-visible { outline: 3px solid rgba(64,92,245,.30); outline-offset: 2px; }
      .composer { position: absolute; z-index: 2147483647; width: 280px; padding: 0; opacity: 0; transform: translateY(5px) scale(.99); transition: opacity .16s ease, transform .18s cubic-bezier(.22, 1, .36, 1); background: var(--snow); border: 1px solid rgba(0,0,0,.08); border-radius: 20px; overflow: hidden; box-shadow: 0 11px 28px rgba(17,26,46,.18); }
      .composer.is-visible { opacity: 1; transform: translateY(0) scale(1); }
      .composer-close { flex: 0 0 auto; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 50%; display: grid; place-items: center; background: rgba(0,0,0,.05); color: var(--ash); cursor: pointer; transition: color .16s ease, background .16s ease; }
      .composer-close:hover { color: var(--ink-black); background: rgba(0,0,0,.10); }
      .composer-close:focus-visible { outline: 2px solid rgba(64,92,245,.32); outline-offset: 2px; }
      .composer-close svg { width: 18px; height: 18px; }
      .composer textarea { display: block; resize: none; width: 100%; height: 126px; max-height: 240px; margin: 0; padding: 14px 14px 58px; border: 0; border-radius: 20px; outline: none; color: var(--ink); background: var(--snow); box-shadow: none; font-size: 13px; line-height: 1.5; overflow-y: auto; }
      .composer textarea:focus { border: 0; outline: none; background: var(--snow); box-shadow: none; }
      .composer textarea::placeholder { color: #a0a6b3; }
      .composer-foot { position: absolute; left: 8px; right: 8px; bottom: 8px; display: flex; align-items: center; justify-content: space-between; pointer-events: none; }
      .composer-foot button { pointer-events: auto; }
      .save-button { width: 38px; height: 38px; padding: 0; border: 0; border-radius: 50%; background: var(--blue); color: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: 0 5px 12px rgba(64,92,245,.25); transition: background .16s ease, transform .16s ease; }
      .save-button:hover:not(:disabled) { background: var(--blue-dark); transform: translateY(-1px); }
      .save-button:disabled { opacity: .4; cursor: not-allowed; }
      .save-button svg { width: 19px; height: 19px; stroke-width: 2; }
      .target-outline { display: none; position: fixed; z-index: 2147483643; pointer-events: none; border: 2px solid var(--annotation-color); border-radius: 5px; background: var(--annotation-tint); box-shadow: 0 0 0 3px var(--annotation-halo), inset 0 0 0 1px rgba(255,255,255,.65); transition: left .04s, top .04s, width .04s, height .04s, border-color .16s ease, background .16s ease, box-shadow .16s ease; }
      .pins { position: absolute; left: 0; top: 0; z-index: 2147483644; pointer-events: none; }
      .element-highlight { position: absolute; pointer-events: none; border: 1.5px solid var(--annotation-outline); border-radius: 5px; background: var(--annotation-tint); box-shadow: 0 0 0 2px var(--annotation-halo); transition: border-color .16s ease, background .16s ease, box-shadow .16s ease; }
      .pins.is-exiting .element-highlight { opacity: 0; transition: opacity .2s ease; }
      .annotation-stack { position: absolute; display: flex; flex-direction: column; gap: 7px; pointer-events: auto; }
      .page-comment-row { width: 100%; animation: annotation-reveal .28s cubic-bezier(.22, 1, .36, 1) both; animation-delay: var(--reveal-delay, 0ms); }
      .page-comment { border: none; width: 100%; min-height: 48px; padding: 8px 8px 8px 14px; border-radius: 12px 12px 12px 6px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 9px; align-items: center; background: var(--annotation-color); color: var(--annotation-fg); text-align: left; box-shadow: 0 8px 24px rgba(17,26,46,.14); transition: transform .16s ease, box-shadow .16s ease, background .16s ease, color .16s ease; }
      .annotation-stack[data-placement="left"] .page-comment { padding: 9px 14px 9px 11px; border-radius: 12px 12px 6px 12px; }
      .annotation-stack[data-placement="below"] .page-comment { padding: 14px 11px 9px; border-radius: 6px 12px 12px; }
      .page-comment-row.is-exiting { pointer-events: none; animation: annotation-dismiss .22s cubic-bezier(.55, 0, 1, .45) both; animation-delay: var(--exit-delay, 0ms); }
      .page-comment:hover { transform: translateY(-1px); border-color: rgba(64,92,245,.42); box-shadow: 0 11px 28px rgba(17,26,46,.18); }
      .page-comment-actions { display: flex; align-items: center; gap: 4px; }
      .page-comment-action { width: 30px; height: 30px; padding: 0; border: 0; border-radius: 9px; display: grid; place-items: center; color: var(--annotation-action-color); background: var(--annotation-action-bg); cursor: pointer; box-shadow: none; transition: background .16s ease, color .16s ease, transform .16s ease, opacity .16s ease; }
      .page-comment-action:hover:not(:disabled) { background: var(--annotation-action-hover); color: var(--annotation-fg); transform: translateY(-1px); }
      .page-comment-action:focus-visible { outline: 2px solid var(--annotation-action-focus); outline-offset: 1px; }
      .page-comment-action:disabled { opacity: .58; cursor: wait; }
      .page-comment-action svg { width: 15px; height: 15px; stroke-width: 2; }
      .page-comment-copy { font-size: 12px; font-weight: 650; line-height: 1.4; word-break: break-word; }
      .toast { position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translate(-50%, 20px); padding: 10px 14px; border-radius: 10px; background: var(--navy); color: #fff; font-size: 12px; font-weight: 650; opacity: 0; pointer-events: none; transition: .2s ease; box-shadow: 0 10px 30px rgba(17,26,46,.25); }
      .toast.show { opacity: 1; transform: translate(-50%, 0); }
      :host(.is-capturing) .dock, :host(.is-capturing) .composer, :host(.is-capturing) .toast { opacity: 0 !important; pointer-events: none !important; }
      :host(.is-capturing) .page-comment { grid-template-columns: minmax(0, 1fr); }
      :host(.is-capturing) .page-comment-actions { display: none !important; }
      :host(.is-capturing-note) .element-highlight, :host(.is-capturing-note) .annotation-stack { visibility: hidden !important; }
      :host(.is-capturing-note) .annotation-stack.is-capture-target { visibility: visible !important; }
      :host(.is-capturing-note) .annotation-stack.is-capture-target .page-comment-row { display: none; }
      :host(.is-capturing-note) .annotation-stack.is-capture-target .page-comment-row.is-capture-target { display: block; animation: none; }
      :host(.is-capturing-note) .target-outline { visibility: visible !important; border: 2px solid var(--annotation-color); background: transparent; box-shadow: none; transition: none; }
      :host(.is-capturing-viewport) .target-outline { visibility: hidden !important; }
      [hidden] { display: none !important; }
      @keyframes annotation-reveal { from { opacity: 0; transform: translateY(7px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes annotation-dismiss { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(7px) scale(.985); } }
      @keyframes annotate-pulse { 50% { box-shadow: 0 0 0 7px rgba(64,92,245,.16), 0 11px 28px rgba(17,26,46,.2); } }
      @media (max-width: 520px) {
        .dock { right: 10px; bottom: 10px; width: calc(100vw - 20px); }
        .composer { width: calc(100vw - 24px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .dock, .capture-preview, .color-picker, .composer, .toolbar { transition-duration: .01ms; }
        .page-comment-row, .page-comment-row.is-exiting { animation-duration: .01ms; animation-delay: 0ms; }
      }
    `;
  }
})();
