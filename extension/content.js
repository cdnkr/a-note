(function () {
  "use strict";

  if (window.top !== window || document.getElementById("annotate-extension-root")) return;

  const {
    MAX_CONTENT_LENGTH,
    annotationFingerprint,
    dedupeAnnotations,
    pageUrl,
    readShareId,
    xpathForElement,
  } = globalThis.AnnotateLib;

  const PAGE_COMMENT_MAX_WIDTH = 280;
  const PAGE_COMMENT_ACTIONS_WIDTH = 102;

  const state = {
    annotations: [],
    active: false,
    annotating: false,
    panelOpen: false,
    composerTarget: null,
    activeAnnotationId: null,
    pendingResolutionUntil: new Map(),
    importingShareIds: new Set(),
    sharingIds: new Set(),
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
    <aside class="missing-rail" hidden aria-label="Annotations whose elements were not found"></aside>
    <section class="dock" aria-label="annotate">
      <div class="panel" hidden>
        <header class="panel-header">
          <h2 class="page-title"></h2>
          <button class="icon-button close-panel" type="button" aria-label="Close annotations">${icon("close")}</button>
        </header>
        <div class="annotation-list-shell">
          <div class="annotation-list"></div>
        </div>
        <button class="primary start-button" type="button"><span class="start-icon">${icon("plus")}</span><span class="start-label">Add annotation</span></button>
      </div>
      <div class="launcher">
        <button class="launcher-main" type="button" aria-label="Expand annotate">
          <span class="brand-mark" aria-hidden="true">A</span>
        </button>
        <button class="launcher-action launcher-close-mode" type="button" aria-label="Close annotate mode">${icon("close")}</button>
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
    missingRail: shadow.querySelector(".missing-rail"),
    dock: shadow.querySelector(".dock"),
    panel: shadow.querySelector(".panel"),
    listShell: shadow.querySelector(".annotation-list-shell"),
    list: shadow.querySelector(".annotation-list"),
    launcher: shadow.querySelector(".launcher"),
    launcherMain: shadow.querySelector(".launcher-main"),
    closeMode: shadow.querySelector(".launcher-close-mode"),
    startButton: shadow.querySelector(".start-button"),
    closePanel: shadow.querySelector(".close-panel"),
    pageTitle: shadow.querySelector(".page-title"),
    composer: shadow.querySelector(".composer"),
    composerClose: shadow.querySelector(".composer-close"),
    textarea: shadow.querySelector("textarea"),
    saveButton: shadow.querySelector(".save-button"),
    toast: shadow.querySelector(".toast"),
  };

  let panelHideTimer;
  let hostHideTimer;
  let composerHideTimer;

  bindUi();
  initialise();

  async function initialise() {
    updatePageTitle();
    state.annotations = await loadAnnotations();
    await importSharedAnnotation();
    render();
  }

  function bindUi() {
    ui.launcherMain.addEventListener("click", () => setPanelOpen(!state.panelOpen));
    ui.closeMode.addEventListener("click", () => setActive(false));
    ui.closePanel.addEventListener("click", () => setPanelOpen(false));
    ui.startButton.addEventListener("click", () => setAnnotating(!state.annotating));
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
    ui.list.addEventListener("scroll", updateListFades, { passive: true });
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("click", onPageClick, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.annotating) setAnnotating(false);
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
    if (nextPageKey === pageKey) {
      if (readShareId(location.href)) {
        await importSharedAnnotation();
        render();
      }
      return;
    }

    pageKey = nextPageKey;
    state.annotations = await loadAnnotations();
    closeComposer();
    setAnnotating(false);
    updatePageTitle();
    await importSharedAnnotation();
    render();
  }

  function updatePageTitle() {
    ui.pageTitle.textContent = pageKey.replace(/^https?:\/\//, "");
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
    renderMissingRail();
    positionAnchoredUi();
  }

  function setActive(active) {
    state.active = active;
    clearTimeout(hostHideTimer);
    chrome.runtime.sendMessage({ type: "ANNOTATE_ACTIVE_CHANGED", active }).catch(() => {});
    if (!active) {
      setAnnotating(false);
      setPanelOpen(false);
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
    setPanelOpen(true);
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

  function setPanelOpen(open) {
    state.panelOpen = open;
    clearTimeout(panelHideTimer);
    ui.launcher.classList.toggle("is-open", open);
    if (open) {
      ui.panel.hidden = false;
      renderList();
      requestAnimationFrame(() => {
        if (state.panelOpen) ui.panel.classList.add("is-visible");
      });
      return;
    }

    ui.panel.classList.remove("is-visible");
    panelHideTimer = setTimeout(() => {
      if (!state.panelOpen) ui.panel.hidden = true;
    }, 280);
  }

  function setAnnotating(active, preserveComposer = false) {
    state.annotating = active;
    document.documentElement.classList.toggle("annotate-is-selecting", active);
    ui.startButton.classList.toggle("is-active", active);
    ui.startButton.querySelector(".start-icon").innerHTML = icon(active ? "close" : "plus");
    ui.startButton.querySelector(".start-label").textContent = active ? "Cancel selection" : "Add annotation";
    ui.outline.style.display = "none";
    if (active) {
      setPanelOpen(false);
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
    const width = stackWidth - PAGE_COMMENT_ACTIONS_WIDTH;
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
    setPanelOpen(true);
    render();
    showToast("Annotation saved");
  }

  async function deleteAnnotation(id) {
    state.annotations = state.annotations.filter((item) => item.id !== id);
    await saveAnnotations();
    render();
    showToast("Annotation removed");
  }

  async function copyAnnotation(annotation) {
    if (!annotation) return;
    try {
      const shareUrl = await ensureShareUrl(annotation);
      if (!shareUrl) return;
      await copyText(shareUrl);
      showToast("Share link copied");
    } catch (error) {
      showToast(error?.message || "Could not create share link");
    }
  }

  async function shareAnnotation(annotation) {
    if (!annotation) return;
    try {
      const shareUrl = await ensureShareUrl(annotation);
      if (!shareUrl) return;
      const shareData = {
        title: document.title || "Page annotation",
        text: annotation.content,
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
    } catch (error) {
      showToast(error?.message || "Could not share annotation");
    }
  }

  async function ensureShareUrl(annotation) {
    if (annotation.shareUrl) return annotation.shareUrl;

    const element = resolveElement(annotation.xpath);
    if (!element) throw new Error("Element not found — screenshot unavailable");
    if (state.sharingIds.has(annotation.id)) return null;

    state.sharingIds.add(annotation.id);
    renderList();
    setPageShareButtonState(annotation.id, true);
    try {
      await enterCaptureMode(element, annotation.id);
      const response = await chrome.runtime.sendMessage({
        type: "ANNOTATE_CREATE_SHARE",
        targetUrl: pageKey,
        xpath: annotation.xpath,
        comment: annotation.content,
      });
      if (!response?.ok || !response.share?.shareUrl) {
        throw new Error(response?.error || "Could not create share link");
      }
      Object.assign(annotation, response.share);
      await saveAnnotations();
      return annotation.shareUrl;
    } finally {
      exitCaptureMode();
      state.sharingIds.delete(annotation.id);
      renderList();
      setPageShareButtonState(annotation.id, false);
    }
  }

  function setPageShareButtonState(id, sharing) {
    const button = ui.pins.querySelector(`[data-page-share="${cssEscape(id)}"]`);
    if (!button) return;
    button.disabled = sharing;
    button.setAttribute("aria-busy", String(sharing));
  }

  async function importSharedAnnotation() {
    const shareId = readShareId(location.href);
    if (!shareId || state.importingShareIds.has(shareId)) return;
    state.importingShareIds.add(shareId);

    try {
      const response = await chrome.runtime.sendMessage({ type: "ANNOTATE_FETCH_SHARE", shareId });
      if (!response?.ok || !response.share) throw new Error(response?.error || "Share not found");
      const shared = response.share;
      if (pageUrl(shared.targetUrl) !== pageKey) throw new Error("This share belongs to another page");

      let annotation = state.annotations.find((item) => item.shareId === shareId);
      const fingerprint = annotationFingerprint({ xpath: shared.xpath, content: shared.comment });
      if (!annotation) {
        annotation = state.annotations.find((item) => annotationFingerprint(item) === fingerprint);
      }

      let added = false;
      if (!annotation) {
        annotation = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          xpath: shared.xpath,
          content: shared.comment,
          createdAt: shared.createdAt || new Date().toISOString(),
          imported: true,
        };
        state.annotations.push(annotation);
        added = true;
      }

      Object.assign(annotation, {
        imported: true,
        shareId,
        shareUrl: shared.shareUrl,
        screenshotUrl: shared.screenshotUrl,
        sharedAt: shared.createdAt || new Date().toISOString(),
      });
      state.annotations = dedupeAnnotations(state.annotations);
      state.pendingResolutionUntil.set(shareId, Date.now() + 3000);
      await saveAnnotations();
      setActive(true);
      if (added) showToast("Shared annotation added");
    } catch (error) {
      showToast(error?.message || "Share could not be loaded");
    } finally {
      state.importingShareIds.delete(shareId);
      history.replaceState(history.state, "", pageKey);
    }
  }

  async function enterCaptureMode(element, annotationId) {
    clearCaptureTargets();
    const comment = ui.pins.querySelector(`[data-page-comment="${cssEscape(annotationId)}"]`);
    const commentRow = comment?.closest(".page-comment-row");
    const stack = commentRow?.closest(".annotation-stack");
    commentRow?.classList.add("is-capture-target");
    stack?.classList.add("is-capture-target");
    host.classList.add("is-capturing");
    positionPins();
    await nextPaint();

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

  function exitCaptureMode() {
    host.classList.remove("is-capturing");
    clearCaptureTargets();
    ui.outline.style.display = state.composerTarget ? "block" : "none";
    positionAnchoredUi();
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
    renderList();
    renderPins();
    renderMissingRail();
  }

  function renderList() {
    if (!state.annotations.length) {
      ui.list.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${icon("cursor")}</span>
          <h3>Leave context where it matters</h3>
          <p>Select anything on this page and attach a short note to it.</p>
        </div>`;
      requestAnimationFrame(updateListFades);
      return;
    }

    const reachable = [];
    const stale = [];
    state.annotations.forEach((annotation, index) => {
      (resolveElement(annotation.xpath) ? reachable : stale).push({ annotation, number: index + 1 });
    });

    ui.list.innerHTML = [
      ...reachable.map((item) => annotationCard(item.annotation, item.number, false)),
      stale.length ? `<div class="stale-heading">${icon("warning")} Element not found</div>` : "",
      ...stale.map((item) => annotationCard(item.annotation, "!", true)),
    ].join("");

    ui.list.querySelectorAll("[data-share]").forEach((button) => {
      button.addEventListener("click", () => copyAnnotation(findAnnotation(button.dataset.share)));
    });
    ui.list.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteAnnotation(button.dataset.delete));
    });
    ui.list.querySelectorAll("[data-focus]").forEach((button) => {
      button.addEventListener("click", () => focusAnnotation(findAnnotation(button.dataset.focus)));
    });
    requestAnimationFrame(updateListFades);
  }

  function updateListFades() {
    const canScrollUp = ui.list.scrollTop > 2;
    const canScrollDown = ui.list.scrollTop + ui.list.clientHeight < ui.list.scrollHeight - 2;
    ui.listShell.classList.toggle("has-top-fade", canScrollUp);
    ui.listShell.classList.toggle("has-bottom-fade", canScrollDown);
  }

  function annotationCard(annotation, label, stale) {
    const sharing = state.sharingIds.has(annotation.id);
    const shareLabel = annotation.shareUrl ? "Copy link" : sharing ? "Creating…" : "Copy link";
    return `
      <article class="annotation-card ${stale ? "is-stale" : ""}">
        <button class="annotation-main" type="button" ${stale ? "disabled" : `data-focus="${escapeHtml(annotation.id)}"`}>
          <span class="note-number">${label}</span>
          <span>
            <span class="note-copy">${escapeHtml(annotation.content)}</span>
          </span>
        </button>
        ${stale ? `<p class="stale-copy">This element may have moved or been removed. Your note is still safely stored.</p>` : ""}
        <div class="card-actions">
          <button type="button" data-share="${escapeHtml(annotation.id)}" ${sharing ? "disabled" : ""}>${icon("link")} ${shareLabel}</button>
          <button class="delete" type="button" data-delete="${escapeHtml(annotation.id)}" aria-label="Delete annotation">${icon("trash")}</button>
        </div>
      </article>`;
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
      const comments = items.map(({ annotation, number }) => {
        const revealDelay = revealIndex * 50;
        const sharing = state.sharingIds.has(annotation.id);
        revealIndex += 1;
        return `
        <div class="page-comment-row" style="--reveal-delay: ${revealDelay}ms">
          <button class="page-comment" type="button" data-page-comment="${escapeHtml(annotation.id)}">
            <span class="page-comment-copy">${escapeHtml(annotation.content)}</span>
          </button>
          <button class="page-comment-action page-comment-share" type="button" data-page-share="${escapeHtml(annotation.id)}" aria-label="Share annotation" title="Share annotation" aria-busy="${sharing}" ${sharing ? "disabled" : ""}>${icon("share")}</button>
          <button class="page-comment-action page-comment-delete" type="button" data-page-delete="${escapeHtml(annotation.id)}" aria-label="Delete annotation" title="Delete annotation">${icon("close")}</button>
        </div>`;
      }).join("");
      return `<div class="element-highlight" data-highlight="${escapeHtml(anchorId)}" aria-hidden="true"></div><div class="annotation-stack" data-anchor="${escapeHtml(anchorId)}">${comments}</div>`;
    }).join("");

    ui.pins.querySelectorAll("[data-page-comment]").forEach((comment) => {
      comment.addEventListener("click", () => focusAnnotation(findAnnotation(comment.dataset.pageComment)));
    });
    ui.pins.querySelectorAll("[data-page-share]").forEach((button) => {
      button.addEventListener("click", () => shareAnnotation(findAnnotation(button.dataset.pageShare)));
    });
    ui.pins.querySelectorAll("[data-page-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteAnnotation(button.dataset.pageDelete));
    });
    positionPins();
  }

  function renderMissingRail() {
    const now = Date.now();
    const missing = state.annotations.filter((annotation) => {
      if (!annotation.imported || !annotation.shareId || !annotation.screenshotUrl) return false;
      if (resolveElement(annotation.xpath)) return false;
      return now >= (state.pendingResolutionUntil.get(annotation.shareId) || 0);
    });

    ui.missingRail.hidden = !state.active || missing.length === 0;
    ui.missingRail.innerHTML = missing.map((annotation) => `
      <article class="missing-card">
        <img src="${escapeHtml(annotation.screenshotUrl)}" alt="Shared screenshot showing the annotated element" referrerpolicy="no-referrer">
        <div class="missing-card-body">
          <span class="missing-status">${icon("warning")} Not found on this page</span>
          <p>${escapeHtml(annotation.content)}</p>
        </div>
      </article>
    `).join("");
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
    return Math.min(PAGE_COMMENT_MAX_WIDTH + PAGE_COMMENT_ACTIONS_WIDTH, window.innerWidth - 16);
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

  function focusAnnotation(annotation) {
    if (!annotation) return;
    const element = resolveElement(annotation.xpath);
    if (!element) {
      setPanelOpen(true);
      return;
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    state.activeAnnotationId = annotation.id;
    setPanelOpen(false);
    setTimeout(() => {
      positionPins();
      const comment = ui.pins.querySelector(`[data-page-comment="${cssEscape(annotation.id)}"]`);
      if (comment) {
        comment.classList.add("pulse");
        setTimeout(() => comment.classList.remove("pulse"), 2500);
      }
    }, 450);
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

  function icon(name) {
    const icons = {
      spark: '<svg viewBox="0 0 24 24"><path d="M12 2l1.55 5.45L19 9l-5.45 1.55L12 16l-1.55-5.45L5 9l5.45-1.55L12 2Z"/><path d="m18.5 14 .8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8.8-2.7Z"/></svg>',
      plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
      close: '<svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg>',
      up: '<svg viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>',
      link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
      share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4m-7.6 6.8 7.6 4.4"/></svg>',
      trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4m0 3h.01"/></svg>',
      cursor: '<svg viewBox="0 0 24 24"><path d="m5 3 14 9-6 1-3 6L5 3Z"/></svg>',
    };
    return icons[name] || "";
  }

  function styles() {
    return `
      :host { all: initial; --navy: #111a2e; --ink: #222b3e; --muted: #667085; --blue: #405cf5; --blue-dark: #2e48e8; --blue-pale: #edf3ff; --pink: #fff1f3; --line: #e7eaf0; --ink-black: #000000; --snow: #ffffff; --canvas: #f8f8f8; --fog: #efefef; --pebble: #d9d9d9; --graphite: #636363; --slate: #959595; --steel: #aeaeae; --ash: #7c7c7c; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--navy); }
      *, *::before, *::after { box-sizing: border-box; }
      button, textarea { font: inherit; }
      button { color: inherit; }
      svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .dock { position: fixed; z-index: 2147483645; right: 22px; bottom: 22px; width: 360px; opacity: 0; transform: translateX(calc(100% + 32px)); transition: transform .28s cubic-bezier(.22, 1, .36, 1), opacity .2s ease; filter: drop-shadow(0 18px 40px rgba(20, 29, 50, .16)); }
      .dock.is-visible { opacity: 1; transform: translateX(0); }
      .launcher { width: max-content; min-height: 68px; margin-left: auto; padding: 12px; border: 1px solid rgba(17,26,46,.08); background: #fff; border-radius: 18px; display: flex; align-items: center; gap: 8px; box-shadow: 0 3px 12px rgba(20,29,50,.07); text-align: left; }
      .launcher-main { flex: 0 0 auto; padding: 0; border: 0; background: transparent; display: flex; align-items: center; text-align: left; cursor: pointer; }
      .brand-mark { width: 42px; height: 42px; border-radius: 12px 12px 12px 3px; display: grid; place-items: center; background: var(--blue); color: #fff; font-size: 18px; font-weight: 850; line-height: 1; }
      .launcher-action { flex: 0 0 auto; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: #f5f7fa; display: grid; place-items: center; cursor: pointer; transition: transform .2s, background .2s, color .2s; }
      .launcher-action:hover { background: var(--fog); }
      .launcher-close-mode { background: transparent; color: var(--ash); }
      .launcher-close-mode:hover { background: var(--fog); color: var(--ink-black); }
      .panel { margin-bottom: 10px; opacity: 0; transform: translateX(calc(100% + 32px)); transition: transform .26s cubic-bezier(.22, 1, .36, 1), opacity .18s ease; background: #fff; border: 1px solid rgba(17,26,46,.08); border-radius: 22px; overflow: hidden; }
      .panel.is-visible { opacity: 1; transform: translateX(0); }
      .panel-header { padding: 18px 20px 14px; display: flex; justify-content: space-between; align-items: center; gap: 14px; }
      .panel-header h2 { min-width: 0; flex: 1; margin: 0; overflow: hidden; color: var(--ink-black); font-size: 14px; font-weight: 700; line-height: 1.25; letter-spacing: -.2px; text-overflow: ellipsis; white-space: nowrap; }
      h2 { margin: 6px 0 0; font-size: 23px; line-height: 1.1; letter-spacing: -.65px; }
      .icon-button { border: 0; background: #f4f6f8; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; }
      .icon-button:hover { background: #e9edf3; }
      .annotation-list-shell { position: relative; overflow: hidden; }
      .annotation-list-shell::before, .annotation-list-shell::after { content: ""; position: absolute; z-index: 2; left: 0; right: 0; height: 24px; opacity: 0; pointer-events: none; transition: opacity .16s ease; }
      .annotation-list-shell::before { top: 0; background: linear-gradient(to bottom, var(--snow) 0%, rgba(255,255,255,.88) 35%, rgba(255,255,255,0) 100%); }
      .annotation-list-shell::after { bottom: 0; background: linear-gradient(to top, var(--snow) 0%, rgba(255,255,255,.88) 35%, rgba(255,255,255,0) 100%); }
      .annotation-list-shell.has-top-fade::before, .annotation-list-shell.has-bottom-fade::after { opacity: 1; }
      .annotation-list { max-height: min(440px, 54vh); overflow: auto; padding: 0 14px; scrollbar-width: thin; }
      .empty-state { margin: 2px 6px 16px; padding: 25px 22px; text-align: center; border: 1px solid #e5ecfb; border-radius: 16px; background: linear-gradient(145deg, #f5f9ff, #edf3ff); }
      .empty-icon { margin: 0 auto 12px; width: 38px; height: 38px; border-radius: 11px; background: #fff; color: var(--blue); display: grid; place-items: center; box-shadow: 0 5px 18px rgba(64,92,245,.12); }
      .empty-state h3 { margin: 0 0 6px; font-size: 14px; letter-spacing: -.2px; }
      .empty-state p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
      .primary { margin: 10px 20px 20px; width: calc(100% - 40px); border: 0; border-radius: 11px; min-height: 44px; padding: 0 16px; background: var(--blue); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: 0 7px 16px rgba(64,92,245,.22); }
      .primary:hover { background: var(--blue-dark); }
      .primary.is-active { background: #d92d20; box-shadow: 0 7px 16px rgba(217,45,32,.24); }
      .primary.is-active:hover { background: #b42318; }
      .start-icon { display: grid; place-items: center; }
      .annotation-card { margin: 0 6px 6px; border: 0; border-radius: 17px; overflow: hidden; background: var(--canvas); }
      .annotation-card:nth-child(even) { background: var(--canvas); }
      .annotation-main { width: 100%; display: grid; grid-template-columns: 26px 1fr; gap: 8px; padding: 10px 11px 6px; text-align: left; border: 0; background: transparent; cursor: pointer; }
      .annotation-main:disabled { cursor: default; }
      .note-number { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 8px 8px 8px 2px; background: var(--blue); color: var(--snow); font-size: 11px; font-weight: 800; }
      .note-copy { display: block; color: var(--ink-black); font-size: 13px; font-weight: 650; line-height: 1.4; word-break: break-word; }
      .card-actions { min-height: 32px; padding: 1px 9px 8px 43px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
      .card-actions button { min-height: 28px; border: 0; background: rgba(0,0,0,.05); color: var(--graphite); font-size: 10px; font-weight: 700; display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 9px; border-radius: 999px; box-shadow: none; transition: color .16s ease, background .16s ease; }
      .card-actions button:hover { color: var(--ink-black); background: rgba(0,0,0,.10); }
      .card-actions button:disabled { opacity: .55; cursor: wait; }
      .card-actions button:focus-visible { outline: 2px solid rgba(64,92,245,.32); outline-offset: 2px; }
      .card-actions .delete { width: 28px; padding: 0; justify-content: center; border-radius: 50%; color: var(--ash); }
      .card-actions .delete:hover { color: var(--ink-black); background: rgba(0,0,0,.10); }
      .card-actions svg { width: 15px; height: 15px; }
      .stale-heading { display: flex; align-items: center; gap: 7px; margin: 16px 7px 8px; color: var(--ash); font-size: 10px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; }
      .stale-heading svg { width: 14px; height: 14px; }
      .annotation-card.is-stale { background: var(--fog); }
      .annotation-card.is-stale .note-number { background: var(--blue); }
      .stale-copy { margin: -1px 11px 5px 43px; color: var(--ash); font-size: 10px; line-height: 1.4; }
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
      .target-outline { display: none; position: fixed; z-index: 2147483643; pointer-events: none; border: 2px solid var(--blue); border-radius: 5px; background: rgba(64,92,245,.08); box-shadow: 0 0 0 3px rgba(64,92,245,.12), inset 0 0 0 1px rgba(255,255,255,.65); transition: left .04s, top .04s, width .04s, height .04s; }
      .pins { position: absolute; left: 0; top: 0; z-index: 2147483644; pointer-events: none; }
      .element-highlight { position: absolute; pointer-events: none; border: 1.5px solid rgba(64,92,245,.62); border-radius: 5px; background: rgba(64,92,245,.055); box-shadow: 0 0 0 2px rgba(64,92,245,.06); }
      .pins.is-exiting .element-highlight { opacity: 0; transition: opacity .2s ease; }
      .annotation-stack { position: absolute; display: flex; flex-direction: column; gap: 7px; pointer-events: auto; }
      .page-comment-row { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 44px 44px; grid-template-areas: "comment share delete"; gap: 7px; align-items: start; animation: annotation-reveal .28s cubic-bezier(.22, 1, .36, 1) both; animation-delay: var(--reveal-delay, 0ms); }
      .annotation-stack[data-placement="left"] .page-comment-row { grid-template-columns: 44px 44px minmax(0, 1fr); grid-template-areas: "delete share comment"; }
      .page-comment { grid-area: comment; border: none; width: 100%; min-height: 44px; padding: 9px 11px 9px 14px; border-radius: 12px 12px 12px 6px; display: grid; grid-template-columns: 1fr; gap: 9px; align-items: start; background: var(--blue); color: var(--snow); text-align: left; cursor: pointer; box-shadow: 0 8px 24px rgba(17,26,46,.14); }
      .annotation-stack[data-placement="left"] .page-comment { padding: 9px 14px 9px 11px; border-radius: 12px 12px 6px 12px; }
      .annotation-stack[data-placement="below"] .page-comment { padding: 14px 11px 9px; border-radius: 6px 12px 12px; }
      .page-comment-row.is-exiting { pointer-events: none; animation: annotation-dismiss .22s cubic-bezier(.55, 0, 1, .45) both; animation-delay: var(--exit-delay, 0ms); }
      .page-comment:hover { transform: translateY(-1px); border-color: rgba(64,92,245,.42); box-shadow: 0 11px 28px rgba(17,26,46,.18); }
      .page-comment-action { width: 44px; height: 44px; padding: 0; border: 0; border-radius: 12px; display: none; place-items: center; color: var(--snow); cursor: pointer; box-shadow: 0 8px 24px rgba(17,26,46,.14); transition: filter .16s ease, transform .16s ease, opacity .16s ease; }
      .page-comment-action:hover:not(:disabled) { filter: brightness(1.12); transform: translateY(-1px); }
      .page-comment-action:focus-visible { outline: 3px solid rgba(64,92,245,.24); outline-offset: 2px; }
      .page-comment-action:disabled { opacity: .58; cursor: wait; }
      .page-comment-action svg { width: 18px; height: 18px; stroke-width: 2; }
      .page-comment-share { grid-area: share; background: var(--navy); }
      .page-comment-delete { grid-area: delete; background: #d92d20; }
      .page-comment-number { width: 25px; height: 25px; display: grid; place-items: center; border-radius: 8px 8px 8px 2px; background: var(--blue); color: #fff; font-size: 10px; font-weight: 850; }
      .page-comment-copy { padding-top: 3px; font-size: 12px; font-weight: 650; line-height: 1.4; word-break: break-word; }
      .page-comment.pulse { animation: annotate-pulse 1s ease 2; }
      .missing-rail { position: fixed; z-index: 2147483646; left: 22px; top: 22px; width: min(400px, calc(100vw - 44px)); max-height: calc(100vh - 44px); overflow: auto; display: flex; flex-direction: column; gap: 12px; pointer-events: auto; scrollbar-width: thin; }
      .missing-card { flex: 0 0 auto; overflow: hidden; border: 1px solid rgba(17,26,46,.09); border-radius: 20px; background: var(--snow); box-shadow: 0 18px 46px rgba(17,26,46,.18); }
      .missing-card img { display: block; width: 100%; max-height: 230px; object-fit: cover; background: var(--fog); border-bottom: 1px solid var(--line); }
      .missing-card-body { padding: 15px 17px 17px; }
      .missing-status { display: flex; align-items: center; gap: 7px; color: var(--blue); font-size: 10px; font-weight: 850; letter-spacing: .45px; text-transform: uppercase; }
      .missing-status svg { width: 14px; height: 14px; }
      .missing-card p { margin: 9px 0 0; color: var(--ink-black); font-size: 14px; font-weight: 650; line-height: 1.5; word-break: break-word; }
      .toast { position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translate(-50%, 20px); padding: 10px 14px; border-radius: 10px; background: var(--navy); color: #fff; font-size: 12px; font-weight: 650; opacity: 0; pointer-events: none; transition: .2s ease; box-shadow: 0 10px 30px rgba(17,26,46,.25); }
      .toast.show { opacity: 1; transform: translate(-50%, 0); }
      :host(.is-capturing) .dock, :host(.is-capturing) .composer, :host(.is-capturing) .missing-rail, :host(.is-capturing) .toast { visibility: hidden !important; }
      :host(.is-capturing) .element-highlight, :host(.is-capturing) .annotation-stack { visibility: hidden !important; }
      :host(.is-capturing) .annotation-stack.is-capture-target { visibility: visible !important; }
      :host(.is-capturing) .annotation-stack.is-capture-target .page-comment-row { display: none; }
      :host(.is-capturing) .annotation-stack.is-capture-target .page-comment-row.is-capture-target { display: grid; animation: none; }
      :host(.is-capturing) .target-outline { visibility: visible !important; border: 2px solid var(--blue); background: transparent; box-shadow: none; transition: none; }
      [hidden] { display: none !important; }
      @keyframes annotation-reveal { from { opacity: 0; transform: translateY(7px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes annotation-dismiss { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(7px) scale(.985); } }
      @keyframes annotate-pulse { 50% { box-shadow: 0 0 0 7px rgba(64,92,245,.16), 0 11px 28px rgba(17,26,46,.2); } }
      @media (max-width: 520px) {
        .dock { right: 10px; bottom: 10px; width: calc(100vw - 20px); }
        .composer { width: calc(100vw - 24px); }
        .missing-rail { left: 10px; top: 10px; width: calc(100vw - 20px); max-height: calc(100vh - 96px); }
        .missing-card img { max-height: 42vh; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dock, .panel, .composer, .missing-card { transition-duration: .01ms; }
        .page-comment-row, .page-comment-row.is-exiting { animation-duration: .01ms; animation-delay: 0ms; }
      }
    `;
  }
})();
