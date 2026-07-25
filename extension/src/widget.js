(function (root, factory) {
  root.ANoteWidget = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const {
    MAX_CONTENT_LENGTH,
    isTextTarget,
    pageUrl,
    resolveTextTarget,
    resolveXPath,
    textTargetForRange,
    textTargetKey,
    xpathForElement,
  } = globalThis.ANoteLib;
  const {
    commentLayout,
    connectorGeometry,
    expandRect,
    manualPositionMatchesViewport,
    responsivePosition,
    setConnectorVisible,
  } = globalThis.ANoteLayout;
  const {
    DEFAULT_COLOR_ID,
    COLORS: ANNOTATION_COLORS,
    colorById,
    svgPath,
  } = globalThis.ANoteBrand;

  const DRAG_THRESHOLD = 3;
  const TEXT_HIGHLIGHT_ALPHA = 0.24;
  const EXCALIFONT_SUBSETS = [
    {
      file: "Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2",
      range: "U+20-7e,U+a0-a3,U+a5-a6,U+a8-ab,U+ad-b1,U+b4,U+b6-b8,U+ba-ff,U+131,U+152-153,U+2bc,U+2c6,U+2da,U+2dc,U+304,U+308,U+2013-2014,U+2018-201a,U+201c-201e,U+2020,U+2022,U+2024-2026,U+2030,U+2039-203a,U+20ac,U+2122,U+2212",
    },
    {
      file: "Excalifont-Regular-be310b9bcd4f1a43f571c46df7809174.woff2",
      range: "U+100-130,U+132-137,U+139-149,U+14c-151,U+154-17e,U+192,U+1fc-1ff,U+218-21b,U+237,U+1e80-1e85,U+1ef2-1ef3,U+2113",
    },
    {
      file: "Excalifont-Regular-b9dcf9d2e50a1eaf42fc664b50a3fd0d.woff2",
      range: "U+400-45f,U+490-491,U+2116",
    },
    {
      file: "Excalifont-Regular-41b173a47b57366892116a575a43e2b6.woff2",
      range: "U+37e,U+384-38a,U+38c,U+38e-393,U+395-3a1,U+3a3-3a8,U+3aa-3cf,U+3d7",
    },
    {
      file: "Excalifont-Regular-3f2c5db56cc93c5a6873b1361d730c16.woff2",
      range: "U+2c7,U+2d8-2d9,U+2db,U+2dd,U+302,U+306-307,U+30a-30c,U+326-328,U+212e,U+2211,U+fb01-fb02",
    },
    {
      file: "Excalifont-Regular-349fac6ca4700ffec595a7150a0d1e1d.woff2",
      range: "U+462-463,U+472-475,U+4d8-4d9,U+4e2-4e3,U+4e6-4e9,U+4ee-4ef",
    },
    {
      file: "Excalifont-Regular-623ccf21b21ef6b3a0d87738f77eb071.woff2",
      range: "U+300-301,U+303",
    },
  ];
  function mount(options = {}) {
    const environment = options.environment || {};
    const hostId = options.hostId || "a-extension-root";
    if (window.top !== window) throw new Error("ANote can only mount in the top frame");
    if (document.getElementById(hostId)) throw new Error(`ANote is already mounted as #${hostId}`);

    const state = {
    annotations: [],
    active: false,
    selectionMode: null,
    sharingIds: new Set(),
    capturing: false,
    preview: null,
    colorId: DEFAULT_COLOR_ID,
    colorPickerOpen: false,
    manualPositions: new Map(),
    dragging: null,
    revealedAnnotationIds: new Set(),
    resolvedTextRanges: new Map(),
    textRangeKeys: new Map(),
    textHighlight: null,
    textSelectionPending: false,
    pendingSeeds: Array.isArray(options.seeds) ? [...options.seeds] : [],
    };

    let pageKey = pageUrl(location.href);
    const captureAvailable = typeof environment.capture === "function";
    const textHighlightAvailable = Boolean(
      globalThis.CSS?.highlights
      && typeof globalThis.Highlight === "function",
    );
    const textHighlightName = `${hostId.replace(/[^a-z0-9_-]+/gi, "-")}-text`;
    const launcherEnabled = Boolean(options.launcher);
    const seedPositions = new Map(
      (Array.isArray(options.seeds) ? options.seeds : [])
        .filter((seed) => seed.position || seed.offset)
        .map((seed) => [seed.id, seed.position || seed.offset]),
    );
    const assetUrl = typeof environment.assetUrl === "function"
      ? environment.assetUrl
      : (path) => path;
    const host = document.createElement("div");
    host.id = hostId;
    host.setAttribute("data-a-ui", "true");
    host.style.setProperty("display", "none", "important");
    const shadow = host.attachShadow({ mode: "open" });
    document.documentElement.append(host);
    const pageStyle = document.createElement("style");
    updatePageStyle(colorById(DEFAULT_COLOR_ID));
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
          <div class="preview-actions">
            <button class="preview-share preview-action" type="button" aria-label="Share screenshot" title="Share screenshot">${icon("share")}</button>
            <button class="preview-download preview-action" type="button" aria-label="Download screenshot" title="Download screenshot">${icon("download")}</button>
          </div>
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
        <img class="brand-mark" src="${assetUrl(svgPath(DEFAULT_COLOR_ID))}" alt="" aria-hidden="true">
        <button class="color-button has-tooltip" type="button" aria-label="Choose annotation colour" aria-expanded="false"></button>
        <button class="toolbar-action start-button has-tooltip" type="button" aria-label="Select an element to annotate" aria-pressed="false">
          ${icon("element-select")}
        </button>
        <button class="toolbar-action highlighter-button has-tooltip${textHighlightAvailable ? "" : " is-unavailable"}" type="button" aria-label="${textHighlightAvailable ? "Highlight text" : "Highlight text — unavailable in this browser"}" aria-pressed="false" ${textHighlightAvailable ? "" : "disabled"}>
          ${icon("highlighter")}
        </button>
        <button class="toolbar-action screenshot-button has-tooltip${captureAvailable ? "" : " is-unavailable"}" type="button" aria-label="${captureAvailable ? "Capture viewport" : "Capture viewport — available in the Chrome extension"}" ${captureAvailable ? "" : "disabled"}>
          ${icon("screenshot")}
        </button>
        <button class="toolbar-action close-mode" type="button" aria-label="Close annotate mode" title="Close annotate mode">
          ${icon("close")}
        </button>
      </div>
    </section>
    <button class="launcher" type="button" aria-label="Open annotate demo" hidden>
      <img class="launcher-mark" src="${assetUrl(svgPath(DEFAULT_COLOR_ID))}" alt="" aria-hidden="true">
    </button>
    <div class="toast" role="status" aria-live="polite"></div>
  `;

    const ui = {
    outline: shadow.querySelector(".target-outline"),
    pins: shadow.querySelector(".pins"),
    dock: shadow.querySelector(".dock"),
    brandMark: shadow.querySelector(".brand-mark"),
    screenshotButton: shadow.querySelector(".screenshot-button"),
    closeMode: shadow.querySelector(".close-mode"),
    startButton: shadow.querySelector(".start-button"),
    highlighterButton: shadow.querySelector(".highlighter-button"),
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
    launcher: shadow.querySelector(".launcher"),
    launcherMark: shadow.querySelector(".launcher-mark"),
    toast: shadow.querySelector(".toast"),
    };

    let hostHideTimer;
    let launcherHideTimer;
    let previewHideTimer;
    let colorPickerHideTimer;
    let toastTimer;

    bindUi();
    const ready = initialise();

    const controller = {
      ready,
      setActive,
      toggle() {
        setActive(!state.active);
      },
      status() {
        return { active: state.active, count: state.annotations.length, url: pageKey };
      },
    };
    return controller;

    async function initialise() {
    const [annotations, colorId] = await Promise.all([
      loadAnnotations(),
      loadAnnotationColor(),
    ]);
    state.annotations = annotations;
    state.manualPositions = loadManualPositions();
    applyAnnotationColor(colorId, false);
    render();
    resolvePendingSeeds();
    if (options.initialActive) setActive(true);
  }

    function resolvePendingSeeds() {
      const existingIds = new Set(state.annotations.map((annotation) => annotation.id));
      state.pendingSeeds = state.pendingSeeds.filter((seed) => !existingIds.has(seed.id));
      let progressed = true;
      while (progressed && state.pendingSeeds.length) {
        progressed = false;
        const unresolved = [];
        state.pendingSeeds.forEach((seed) => {
          const root = seed.root === "widget" ? shadow : document;
          const target = root.querySelector(seed.selector);
          if (!target) {
            unresolved.push(seed);
            return;
          }
          const annotation = {
            id: seed.id,
            content: String(seed.content || "").slice(0, MAX_CONTENT_LENGTH),
            createdAt: seed.createdAt || "2026-01-01T00:00:00.000Z",
          };
          if (seed.kind === "text") {
            if (seed.root !== "document") {
              unresolved.push(seed);
              return;
            }
            const range = document.createRange();
            range.selectNodeContents(target);
            const textTarget = textTargetForRange(range);
            if (!textTarget) {
              unresolved.push(seed);
              return;
            }
            annotation.target = textTarget;
          } else {
            const xpath = xpathForElement(target);
            if (!xpath) {
              unresolved.push(seed);
              return;
            }
            annotation.xpath = xpath;
          }
          state.annotations.push(annotation);
          progressed = true;
          render();
        });
        state.pendingSeeds = unresolved;
      }
    }

    function bindUi() {
    ui.closeMode.addEventListener("click", () => setActive(false));
    if (captureAvailable) ui.screenshotButton.addEventListener("click", captureViewportShare);
    if (launcherEnabled) ui.launcher.addEventListener("click", () => setActive(true));
    ui.startButton.addEventListener("click", () => {
      setSelectionMode(state.selectionMode === "element" ? null : "element");
    });
    if (textHighlightAvailable) {
      ui.highlighterButton.addEventListener("click", () => {
        setSelectionMode(state.selectionMode === "text" ? null : "text");
      });
    }
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
    ui.pins.addEventListener("pointerdown", startAnnotationDrag);
    ui.pins.addEventListener("pointermove", moveAnnotationDrag);
    ui.pins.addEventListener("pointerup", finishAnnotationDrag);
    ui.pins.addEventListener("pointercancel", finishAnnotationDrag);
    ui.pins.addEventListener("input", updateAnnotationContent);
    ui.pins.addEventListener("keydown", handleAnnotationEditKeydown);
    ui.pins.addEventListener("focusout", finishAnnotationEdit);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onTextPointerUp, true);
    document.addEventListener("click", onPageClick, true);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (state.colorPickerOpen) {
        setColorPickerOpen(false);
      } else if (state.selectionMode) {
        setSelectionMode(null);
      }
    }, true);
    window.addEventListener("scroll", positionAnchoredUi, { passive: true });
    document.addEventListener("scroll", positionAnchoredUi, { capture: true, passive: true });
    window.addEventListener("resize", positionAnchoredUi, { passive: true });
    document.fonts?.addEventListener?.("loadingdone", positionAnchoredUi);
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    window.setInterval(handleUrlChange, 1000);
    window.setInterval(refreshResolvedTargets, 1500);
  }

  async function handleUrlChange() {
    const nextPageKey = pageUrl(location.href);
    if (nextPageKey === pageKey) return;

    finishAnnotationDrag();
    pageKey = nextPageKey;
    state.annotations = await loadAnnotations();
    state.manualPositions = loadManualPositions();
    state.revealedAnnotationIds.clear();
    closePreview();
    setColorPickerOpen(false);
    setSelectionMode(null);
    render();
  }

  function refreshResolvedTargets() {
    if (!state.active) return;
    if (state.pendingSeeds.length) resolvePendingSeeds();
    refreshTextHighlights();
    const expected = state.annotations
      .filter((annotation) => resolveAnnotationTarget(annotation))
      .length;
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
    clearTimeout(launcherHideTimer);
    try {
      environment.activeChanged?.(active);
    } catch (_error) {
      // Environment notifications must not affect the in-page UI.
    }
    if (!active) {
      finishAnnotationDrag();
      setSelectionMode(null);
      refreshTextHighlights();
      closePreview();
      setColorPickerOpen(false);
      ui.dock.classList.remove("is-visible");
      const annotationExitDuration = playAnnotationExit();
      if (launcherEnabled) {
        host.style.setProperty("display", "block", "important");
        ui.launcher.hidden = false;
        requestAnimationFrame(() => {
          if (!state.active) ui.launcher.classList.add("is-visible");
        });
        return;
      }
      hostHideTimer = setTimeout(() => {
        if (!state.active) host.style.setProperty("display", "none", "important");
      }, Math.max(300, annotationExitDuration + 40));
      return;
    }

    host.style.setProperty("display", "block", "important");
    if (launcherEnabled) {
      ui.launcher.classList.remove("is-visible");
      launcherHideTimer = setTimeout(() => {
        if (state.active) ui.launcher.hidden = true;
      }, 240);
    }
    ui.pins.classList.remove("is-exiting");
    state.revealedAnnotationIds.clear();
    render();
    requestAnimationFrame(() => {
      if (!state.active) return;
      ui.dock.classList.add("is-visible");
      positionAnchoredUi();
      setTimeout(() => {
        if (state.active) positionAnchoredUi();
      }, 320);
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

  function setSelectionMode(mode) {
    const nextMode = mode === "element" || (mode === "text" && textHighlightAvailable)
      ? mode
      : null;
    state.selectionMode = nextMode;
    state.textSelectionPending = false;
    document.documentElement.classList.toggle(
      "a-is-selecting-element",
      nextMode === "element",
    );
    document.documentElement.classList.toggle(
      "a-is-selecting-text",
      nextMode === "text",
    );
    ui.startButton.classList.toggle("is-active", nextMode === "element");
    ui.startButton.setAttribute("aria-pressed", String(nextMode === "element"));
    ui.startButton.setAttribute(
      "aria-label",
      nextMode === "element"
        ? "Stop selecting elements"
        : "Select an element to annotate",
    );
    ui.highlighterButton.classList.toggle("is-active", nextMode === "text");
    ui.highlighterButton.setAttribute("aria-pressed", String(nextMode === "text"));
    ui.highlighterButton.setAttribute(
      "aria-label",
      !textHighlightAvailable
        ? "Highlight text — unavailable in this browser"
        : nextMode === "text"
          ? "Stop highlighting text"
          : "Highlight text",
    );
    ui.outline.style.display = "none";
    if (nextMode === "element") {
      showToast("Select an element to annotate");
    } else if (nextMode === "text") {
      showToast("Select text to highlight");
    }
  }

  function onPointerMove(event) {
    if (state.selectionMode !== "element" || isExtensionUi(event)) return;
    const target = selectableEventTarget(event);
    if (!target) return;
    positionTargetOutline(target.getBoundingClientRect());
  }

  function onTextPointerUp(event) {
    if (
      state.selectionMode !== "text"
      || state.textSelectionPending
      || isExtensionUi(event)
    ) {
      return;
    }
    state.textSelectionPending = true;
    requestAnimationFrame(() => {
      state.textSelectionPending = false;
      if (state.selectionMode !== "text") return;
      completeTextSelection();
    });
  }

  function completeTextSelection() {
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return;
    const sourceRange = selection.getRangeAt(0);
    const range = sourceRange.cloneRange?.() || sourceRange;
    const target = textTargetForRange(range);
    if (!target) {
      showToast("Select ordinary page text to highlight");
      return;
    }
    selection.removeAllRanges();
    createTextAnnotation(target);
  }

  function onPageClick(event) {
    if (!state.active || isExtensionUi(event)) return;
    if (state.selectionMode === "text") return;
    if (state.selectionMode === "element") {
      const target = selectableEventTarget(event);
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      createElementAnnotation(target);
      return;
    }

    const textTarget = textTargetAtPoint(event.clientX, event.clientY);
    if (!textTarget) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    createTextAnnotation(textTarget);
  }

  function createElementAnnotation(target) {
    const annotation = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      xpath: xpathForElement(target),
      content: "",
      createdAt: new Date().toISOString(),
    };
    addAnnotation(annotation);
  }

  function createTextAnnotation(target) {
    const annotation = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      target: cloneTextTarget(target),
      content: "",
      createdAt: new Date().toISOString(),
    };
    addAnnotation(annotation);
  }

  function addAnnotation(annotation) {
    state.annotations.push(annotation);
    setSelectionMode(null);
    render();
    const copy = ui.pins.querySelector(
      `[data-page-comment="${cssEscape(annotation.id)}"] .page-comment-copy`,
    );
    if (copy) startAnnotationEdit(copy);
    saveAnnotations().catch(() => showToast("Could not save annotation"));
  }

  function cloneTextTarget(target) {
    return {
      type: "text",
      rootXPath: target.rootXPath,
      startOffset: target.startOffset,
      endOffset: target.endOffset,
      quote: {
        exact: target.quote.exact,
        prefix: target.quote.prefix,
        suffix: target.quote.suffix,
      },
    };
  }

  function startAnnotationDrag(event) {
    if (event.button !== 0 || state.capturing || state.dragging) return;
    const copy = event.target instanceof Element
      ? event.target.closest(".page-comment-copy")
      : null;
    const stack = copy?.closest(".annotation-stack");
    const annotation = stack && findAnnotation(stack.dataset.anchor);
    if (!copy || !stack || !annotation || copy.isContentEditable) return;

    const rect = stack.getBoundingClientRect();
    state.dragging = {
      id: annotation.id,
      pointerId: event.pointerId,
      copy,
      stack,
      startClientX: event.clientX,
      startClientY: event.clientY,
      grabX: event.clientX + window.scrollX - (rect.left + window.scrollX),
      grabY: event.clientY + window.scrollY - (rect.top + window.scrollY),
      actionSide: stack.dataset.actionSide === "left" ? "left" : "right",
      moved: false,
    };
    copy.setPointerCapture?.(event.pointerId);
    copy.setAttribute("aria-grabbed", "true");
    stack.classList.add("is-dragging");
    event.preventDefault();
    event.stopPropagation();
  }

  function moveAnnotationDrag(event) {
    const drag = state.dragging;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = Math.hypot(
      event.clientX - drag.startClientX,
      event.clientY - drag.startClientY,
    );
    if (!drag.moved && distance < DRAG_THRESHOLD) return;

    drag.moved = true;
    const stackWidth = drag.stack.offsetWidth;
    const stackHeight = drag.stack.offsetHeight;
    const minimumLeft = window.scrollX + 8;
    const minimumTop = window.scrollY + 8;
    const maximumLeft = Math.max(
      minimumLeft,
      window.scrollX + window.innerWidth - stackWidth - 8,
    );
    const maximumTop = Math.max(
      minimumTop,
      window.scrollY + window.innerHeight - stackHeight - 8,
    );
    const left = Math.min(
      Math.max(event.clientX + window.scrollX - drag.grabX, minimumLeft),
      maximumLeft,
    );
    const top = Math.min(
      Math.max(event.clientY + window.scrollY - drag.grabY, minimumTop),
      maximumTop,
    );

    state.manualPositions.set(drag.id, {
      left,
      top,
      screenWidth: window.innerWidth,
      actionSide: drag.actionSide,
    });
    positionPins();
    event.preventDefault();
    event.stopPropagation();
  }

  function finishAnnotationDrag(event) {
    const drag = state.dragging;
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    drag.stack.classList.remove("is-dragging");
    drag.copy.removeAttribute("aria-grabbed");
    if (drag.copy.hasPointerCapture?.(drag.pointerId)) {
      drag.copy.releasePointerCapture(drag.pointerId);
    }
    state.dragging = null;
    if (drag.moved) {
      saveManualPositions();
    } else if (event?.type === "pointerup") {
      startAnnotationEdit(drag.copy, event.clientX, event.clientY);
    }
    event?.preventDefault();
    event?.stopPropagation();
  }

  function startAnnotationEdit(copy, clientX, clientY) {
    copy.setAttribute("contenteditable", "plaintext-only");
    copy.setAttribute("role", "textbox");
    copy.setAttribute("aria-label", "Edit annotation");
    copy.setAttribute("aria-multiline", "true");
    copy.focus({ preventScroll: true });
    placeAnnotationCaret(copy, clientX, clientY);
  }

  function updateAnnotationContent(event) {
    const copy = event.target instanceof Element
      ? event.target.closest(".page-comment-copy")
      : null;
    const stack = copy?.closest(".annotation-stack");
    const annotation = stack && findAnnotation(stack.dataset.anchor);
    if (!copy?.isContentEditable || !annotation) return;

    const editableContent = readEditableContent(copy);
    const content = editableContent.slice(0, MAX_CONTENT_LENGTH);
    if (content !== editableContent) {
      copy.textContent = content;
      placeAnnotationCaret(copy);
    }
    annotation.content = content;
    saveAnnotations().catch(() => showToast("Could not save annotation"));
    positionPins();
  }

  function handleAnnotationEditKeydown(event) {
    if (event.key !== "Escape" || !(event.target instanceof Element)) return;
    const copy = event.target.closest(".page-comment-copy");
    if (!copy?.isContentEditable) return;
    const stack = copy.closest(".annotation-stack");
    const annotation = stack && findAnnotation(stack.dataset.anchor);
    event.preventDefault();
    event.stopPropagation();
    copy.blur();
    if (annotation?.content === "" && !isTextTarget(annotation.target)) {
      deleteAnnotation(annotation.id);
    }
  }

  function finishAnnotationEdit(event) {
    const copy = event.target instanceof Element
      ? event.target.closest(".page-comment-copy")
      : null;
    if (!copy?.isContentEditable) return;
    const stack = copy.closest(".annotation-stack");
    const annotation = stack && findAnnotation(stack.dataset.anchor);
    copy.setAttribute("contenteditable", "false");
    copy.removeAttribute("role");
    copy.removeAttribute("aria-label");
    copy.removeAttribute("aria-multiline");
    if (annotation) copy.textContent = annotation.content;
  }

  function readEditableContent(copy) {
    return String(copy.innerText ?? copy.textContent ?? "").replace(/\r\n?/g, "\n");
  }

  function placeAnnotationCaret(copy, clientX, clientY) {
    const selection = shadow.getSelection?.() || window.getSelection?.();
    if (!selection) return;

    const pointRange = Number.isFinite(clientX) && Number.isFinite(clientY)
      ? document.caretRangeFromPoint?.(clientX, clientY)
      : null;
    const range = pointRange && copy.contains(pointRange.startContainer)
      ? pointRange
      : document.createRange();
    if (range !== pointRange) {
      range.selectNodeContents(copy);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function isExtensionUi(event) {
    return event.composedPath().includes(host);
  }

  function selectableEventTarget(event) {
    const path = typeof event.composedPath === "function"
      ? event.composedPath()
      : [event.target];
    return path.find((candidate) => (
      candidate instanceof Element
      && candidate !== document.documentElement
      && candidate !== document.body
      && candidate !== host
    )) || null;
  }

  function textTargetAtPoint(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    const hitKeys = new Set();
    if (typeof globalThis.CSS?.highlights?.highlightsFromPoint === "function") {
      try {
        const hits = globalThis.CSS.highlights.highlightsFromPoint(clientX, clientY);
        hits.forEach((hit) => {
          if (hit.highlight !== state.textHighlight) return;
          hit.ranges.forEach((range) => {
            const key = state.textRangeKeys.get(range);
            if (key) hitKeys.add(key);
          });
        });
      } catch (_error) {
        // Fall through to range rectangle hit testing.
      }
    }
    if (!hitKeys.size) {
      state.resolvedTextRanges.forEach((range, key) => {
        if (rangeContainsPoint(range, clientX, clientY)) hitKeys.add(key);
      });
    }
    if (!hitKeys.size) return null;

    for (let index = state.annotations.length - 1; index >= 0; index -= 1) {
      const target = state.annotations[index]?.target;
      if (isTextTarget(target) && hitKeys.has(textTargetKey(target))) return target;
    }
    return null;
  }

  function rangeContainsPoint(range, clientX, clientY) {
    return Array.from(range?.getClientRects?.() || []).some((rect) => (
      clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom
    ));
  }

  async function deleteAnnotation(id) {
    state.annotations = state.annotations.filter((item) => item.id !== id);
    state.manualPositions.delete(id);
    state.revealedAnnotationIds.delete(id);
    saveManualPositions();
    await saveAnnotations();
    render();
    showToast("Annotation removed");
  }

  async function shareAnnotation(annotation) {
    if (!captureAvailable || !annotation || state.capturing || state.sharingIds.has(annotation.id)) return;
    const target = resolveAnnotationTarget(annotation);
    if (!target) {
      showToast("Annotation target not found — screenshot unavailable");
      return;
    }

    state.sharingIds.add(annotation.id);
    setPageShareButtonState(annotation.id, true);
    try {
      await enterNoteCaptureMode(target, annotation.id);
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
    if (!captureAvailable || state.capturing) return;
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
    return environment.capture({
      targetUrl: pageKey,
      colorToken: state.colorId,
    });
  }

  function setPageShareButtonState(id, sharing) {
    const button = ui.pins.querySelector(`[data-page-share="${cssEscape(id)}"]`);
    if (!button) return;
    button.disabled = !captureAvailable || sharing || state.capturing;
    button.setAttribute("aria-busy", String(sharing));
  }

  async function enterNoteCaptureMode(target, annotationId) {
    setCaptureBusy(true);
    clearCaptureTargets();
    const comment = ui.pins.querySelector(`[data-page-comment="${cssEscape(annotationId)}"]`);
    const commentRow = comment?.closest(".page-comment-row");
    const stack = commentRow?.closest(".annotation-stack");
    const connector = ui.pins.querySelector(`[data-connector="${cssEscape(annotationId)}"]`);
    commentRow?.classList.add("is-capture-target");
    stack?.classList.add("is-capture-target");
    connector?.classList.add("is-capture-target");
    host.classList.add("is-capturing", "is-capturing-note");
    if (target.type === "text") {
      host.classList.add("is-capturing-text-note");
      refreshTextHighlights(target.key);
    } else {
      clearTextHighlights();
    }
    positionPins();
    await waitForCaptureFade();

    let rect = targetRect(target);
    const commentRect = comment?.getBoundingClientRect();
    const margin = 12;
    if (!isCaptureRectVisible(rect, margin) || !isCaptureRectVisible(commentRect, margin)) {
      scrollTargetIntoView(target);
      await nextPaint();
      positionPins();
      await nextPaint();
      rect = targetRect(target);
    }

    if (target.type === "element") {
      positionTargetOutline(target.element.getBoundingClientRect());
    } else {
      ui.outline.style.display = "none";
    }
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
    host.classList.remove(
      "is-capturing",
      "is-capturing-note",
      "is-capturing-text-note",
      "is-capturing-viewport",
    );
    clearCaptureTargets();
    setCaptureBusy(false);
    ui.outline.style.display = "none";
    refreshTextHighlights();
    positionAnchoredUi();
  }

  function setCaptureBusy(busy) {
    state.capturing = busy;
    ui.screenshotButton.disabled = !captureAvailable || busy;
    ui.screenshotButton.setAttribute("aria-busy", String(busy));
    ui.colorButton.disabled = busy;
    ui.startButton.disabled = busy;
    ui.highlighterButton.disabled = !textHighlightAvailable || busy;
    ui.pins.querySelectorAll("[data-page-share]").forEach((button) => {
      button.disabled = !captureAvailable || busy || state.sharingIds.has(button.dataset.pageShare);
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
    const color = colorById(colorId);
    state.colorId = color.id;
    host.style.setProperty("--annotation-color", color.value);
    host.style.setProperty("--annotation-fg", color.foreground);
    host.style.setProperty("--annotation-outline", color.value);
    ui.brandMark.src = assetUrl(svgPath(color.id));
    ui.launcherMark.src = assetUrl(svgPath(color.id));
    ui.colorButton.style.backgroundColor = color.value;
    ui.colorButton.setAttribute("aria-label", "Choose annotation colour");
    updatePageStyle(color);
    ui.colorGrid.querySelectorAll("[data-color-id]").forEach((button) => {
      const active = button.dataset.colorId === color.id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", String(active));
    });
    if (persist) {
      Promise.resolve(environment.saveColor?.(color.id)).catch(() => {});
    }
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
        title: document.title || "ANoted screenshot",
        text: "Shared with ANote",
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
      link.download = `a-${preview.kind}-${hostName || "page"}.jpg`;
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
    return resolveXPath(xpath, document);
  }

  function resolveAnnotationTarget(annotation) {
    if (!annotation) return null;
    if (isTextTarget(annotation.target)) {
      const key = textTargetKey(annotation.target);
      const range = state.resolvedTextRanges.get(key)
        || resolveTextTarget(annotation.target, document);
      if (!key || !range) return null;
      return {
        type: "text",
        key,
        groupKey: `text:${key}`,
        range,
      };
    }

    const element = resolveElement(annotation.xpath);
    return element
      ? {
          type: "element",
          key: annotation.xpath,
          groupKey: element,
          element,
        }
      : null;
  }

  function refreshTextHighlights(onlyTargetKey = null) {
    if (!textHighlightAvailable || !state.active) {
      clearTextHighlights();
      return;
    }

    const targets = new Map();
    state.annotations.forEach((annotation) => {
      if (!isTextTarget(annotation.target)) return;
      const key = textTargetKey(annotation.target);
      if (
        !key
        || (onlyTargetKey && key !== onlyTargetKey)
        || targets.has(key)
      ) {
        return;
      }
      targets.set(key, annotation.target);
    });

    const ranges = [];
    const resolvedTextRanges = new Map();
    const textRangeKeys = new Map();
    targets.forEach((target, key) => {
      const range = resolveTextTarget(target, document);
      if (!range) return;
      ranges.push(range);
      resolvedTextRanges.set(key, range);
      textRangeKeys.set(range, key);
    });
    if (!ranges.length) {
      clearTextHighlights();
      return;
    }

    try {
      const highlight = new globalThis.Highlight(...ranges);
      globalThis.CSS.highlights.set(textHighlightName, highlight);
      state.textHighlight = highlight;
      state.resolvedTextRanges = resolvedTextRanges;
      state.textRangeKeys = textRangeKeys;
    } catch (_error) {
      clearTextHighlights();
    }
  }

  function clearTextHighlights() {
    if (textHighlightAvailable) {
      globalThis.CSS.highlights.delete(textHighlightName);
    }
    state.textHighlight = null;
    state.resolvedTextRanges.clear();
    state.textRangeKeys.clear();
  }

  function targetRect(target) {
    if (target.type === "element") {
      return expandRect(target.element.getBoundingClientRect());
    }
    const rect = target.range.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  function scrollTargetIntoView(target) {
    if (target.type === "element") {
      target.element.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
      return;
    }
    const startNode = target.range.startContainer;
    const startElement = startNode?.nodeType === 1 ? startNode : startNode?.parentElement;
    startElement?.scrollIntoView?.({ behavior: "auto", block: "center", inline: "center" });
  }

  function updatePageStyle(color) {
    pageStyle.textContent = `
      html.a-is-selecting-element,
      html.a-is-selecting-element * {
        cursor: crosshair !important;
      }
      html.a-is-selecting-text,
      html.a-is-selecting-text * {
        cursor: text !important;
      }
      ::highlight(${textHighlightName}) {
        background-color: ${transparentHighlightColor(color.value)} !important;
      }
    `;
  }

  function transparentHighlightColor(value) {
    const match = String(value || "").match(/^#([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
    if (!match) return `rgba(64, 92, 245, ${TEXT_HIGHLIGHT_ALPHA})`;
    return `rgba(${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)}, ${TEXT_HIGHLIGHT_ALPHA})`;
  }

  function render() {
    refreshTextHighlights();
    renderPins();
  }

  function renderPins() {
    finishAnnotationDrag();
    ui.pins.innerHTML = state.annotations.map((annotation) => {
      const target = resolveAnnotationTarget(annotation);
      if (!target) return "";
      const sharing = state.sharingIds.has(annotation.id);
      return `
        <svg class="annotation-connector" data-connector="${escapeHtml(annotation.id)}" aria-hidden="true"><path></path></svg>
        ${target.type === "element" ? `<div class="element-highlight" data-highlight="${escapeHtml(annotation.id)}" aria-hidden="true"></div>` : ""}
        <div class="annotation-stack" data-anchor="${escapeHtml(annotation.id)}">
        <div class="page-comment-row">
          <article class="page-comment" data-page-comment="${escapeHtml(annotation.id)}">
            <span class="page-comment-copy">${escapeHtml(annotation.content)}</span>
            <span class="page-comment-actions">
              <button class="page-comment-action page-comment-share has-tooltip${captureAvailable ? "" : " is-unavailable"}" type="button" data-page-share="${escapeHtml(annotation.id)}" aria-label="${captureAvailable ? "Capture screenshot" : "Capture screenshot — available in the Chrome extension"}" aria-busy="${sharing}" ${captureAvailable && !sharing ? "" : "disabled"}>${icon("screenshot")}</button>
              <button class="page-comment-action page-comment-delete has-tooltip" type="button" data-page-delete="${escapeHtml(annotation.id)}" aria-label="Delete annotation">${icon("close")}</button>
            </span>
          </article>
        </div>
        </div>`;
    }).join("");

    if (captureAvailable) {
      ui.pins.querySelectorAll("[data-page-share]").forEach((button) => {
        button.addEventListener("click", () => shareAnnotation(findAnnotation(button.dataset.pageShare)));
      });
    }
    ui.pins.querySelectorAll("[data-page-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteAnnotation(button.dataset.pageDelete));
    });
    positionPins();
  }

  function annotationPlacement(rect, noteWidth) {
    const placement = commentLayout(rect, window.innerWidth, noteWidth);
    return {
      ...placement,
      left: placement.left + window.scrollX,
      top: placement.top + window.scrollY,
    };
  }

  function positionTargetOutline(rect) {
    const outlineRect = expandRect(rect);
    Object.assign(ui.outline.style, {
      display: "block",
      left: `${outlineRect.left}px`,
      top: `${outlineRect.top}px`,
      width: `${outlineRect.width}px`,
      height: `${outlineRect.height}px`,
    });
    return outlineRect;
  }

  function positionPins() {
    if (!state.active) return;
    const automaticOffsets = new Map();
    ui.pins.querySelectorAll(".annotation-stack").forEach((stack) => {
      const annotation = findAnnotation(stack.dataset.anchor);
      const target = annotation && resolveAnnotationTarget(annotation);
      const highlight = ui.pins.querySelector(`[data-highlight="${cssEscape(stack.dataset.anchor)}"]`);
      const connector = ui.pins.querySelector(`[data-connector="${cssEscape(stack.dataset.anchor)}"]`);
      if (!target) {
        stack.hidden = true;
        if (highlight) highlight.hidden = true;
        setConnectorVisible(connector, false);
        return;
      }
      const outlineRect = targetRect(target);
      const targetHidden = target.type === "element"
        ? Boolean(target.element.closest?.("[hidden]"))
        : outlineRect.width <= 0 || outlineRect.height <= 0;
      const outsideViewport = targetHidden
        || outlineRect.bottom < 0
        || outlineRect.top > window.innerHeight
        || outlineRect.right < 0
        || outlineRect.left > window.innerWidth;
      stack.hidden = outsideViewport;
      if (highlight) {
        highlight.hidden = outsideViewport;
        highlight.style.left = `${outlineRect.left + window.scrollX}px`;
        highlight.style.top = `${outlineRect.top + window.scrollY}px`;
        highlight.style.width = `${outlineRect.width}px`;
        highlight.style.height = `${outlineRect.height}px`;
      }
      if (outsideViewport) {
        setConnectorVisible(connector, false);
        return;
      }

      stack.style.removeProperty("width");
      const noteWidth = stack.getBoundingClientRect().width;
      const manualPosition = state.manualPositions.get(annotation.id);
      if (manualPositionMatchesViewport(manualPosition, window.innerWidth)) {
        stack.dataset.placement = "manual";
        stack.dataset.actionSide = manualPosition.actionSide === "left" ? "left" : "right";
        stack.classList.add("is-manual");
        stack.style.left = `${manualPosition.left}px`;
        stack.style.top = `${manualPosition.top}px`;
        positionConnector(connector, outlineRect, stack);
        return;
      }

      const placement = annotationPlacement(outlineRect, noteWidth);
      const seedPosition = responsivePosition(
        seedPositions.get(annotation.id),
        window.innerWidth,
      );
      if (seedPosition && (!seedPosition.minWidth || window.innerWidth >= seedPosition.minWidth)) {
        const actionSide = seedPosition.actionSide === "left"
          || seedPosition.actionSide === "right"
          ? seedPosition.actionSide
          : placement.actionSide;
        const left = placement.left + (Number(seedPosition.x) || 0);
        const top = placement.top + (Number(seedPosition.y) || 0);
        stack.dataset.placement = "manual";
        stack.dataset.actionSide = actionSide;
        stack.classList.add("is-manual");
        stack.style.left = `${left}px`;
        stack.style.top = `${top}px`;
        if (seedPosition.pagePinned) {
          state.manualPositions.set(annotation.id, {
            left,
            top,
            screenWidth: window.innerWidth,
            actionSide,
          });
        }
        positionConnector(connector, outlineRect, stack);
        return;
      }

      stack.classList.remove("is-manual");
      setConnectorVisible(connector, false);
      const offset = automaticOffsets.get(target.groupKey) || 0;
      placement.top += offset;
      automaticOffsets.set(target.groupKey, offset + stack.offsetHeight + 7);
      stack.dataset.placement = placement.placement;
      stack.dataset.actionSide = placement.actionSide;
      stack.style.left = `${placement.left}px`;
      stack.style.top = `${placement.top}px`;
    });
    revealVisibleAnnotations();
  }

  function revealVisibleAnnotations() {
    if (!state.active || ui.pins.classList.contains("is-exiting")) return;

    const rowsToReveal = [];
    ui.pins.querySelectorAll(".annotation-stack").forEach((stack) => {
      const id = stack.dataset.anchor;
      if (!id || stack.hidden || state.revealedAnnotationIds.has(id)) return;
      state.revealedAnnotationIds.add(id);
      const row = stack.querySelector(".page-comment-row");
      if (row) rowsToReveal.push(row);
    });

    rowsToReveal.forEach((row, index) => {
      row.style.setProperty("--reveal-delay", `${index * 50}ms`);
      row.classList.add("is-revealing");
      row.addEventListener("animationend", () => {
        row.classList.remove("is-revealing");
        row.style.removeProperty("--reveal-delay");
      }, { once: true });
    });
  }

  function positionConnector(connector, outlineRect, stack) {
    const copyRect = stack.querySelector(".page-comment-copy")?.getBoundingClientRect();
    if (!connector || !copyRect) return;
    const targetRect = {
      left: outlineRect.left + window.scrollX,
      top: outlineRect.top + window.scrollY,
      right: outlineRect.right + window.scrollX,
      bottom: outlineRect.bottom + window.scrollY,
      width: outlineRect.width,
      height: outlineRect.height,
    };
    const annotationRect = {
      left: copyRect.left + window.scrollX,
      top: copyRect.top + window.scrollY,
      right: copyRect.right + window.scrollX,
      bottom: copyRect.bottom + window.scrollY,
      width: copyRect.width,
      height: copyRect.height,
    };
    const geometry = connectorGeometry(targetRect, annotationRect);
    setConnectorVisible(connector, true);
    connector.style.left = `${geometry.left}px`;
    connector.style.top = `${geometry.top}px`;
    connector.style.width = `${geometry.width}px`;
    connector.style.height = `${geometry.height}px`;
    connector.setAttribute("viewBox", `0 0 ${geometry.width} ${geometry.height}`);
    connector.querySelector("path")?.setAttribute("d", geometry.path);
  }

  function positionAnchoredUi() {
    positionPins();
  }

  function findAnnotation(id) {
    return state.annotations.find((annotation) => annotation.id === id);
  }

  async function loadAnnotations() {
    try {
      const stored = await environment.loadAnnotations?.(pageKey);
      return Array.isArray(stored) ? stored : [];
    } catch (_error) {
      return [];
    }
  }

  async function loadAnnotationColor() {
    try {
      const stored = await environment.loadColor?.();
      return typeof stored === "string" ? stored : DEFAULT_COLOR_ID;
    } catch (_error) {
      return DEFAULT_COLOR_ID;
    }
  }

  function loadManualPositions() {
    try {
      const stored = environment.loadManualPositions?.(pageKey) || {};
      return new Map(
        Object.entries(stored).filter(([, position]) => (
          manualPositionMatchesViewport(position, position?.screenWidth)
        )),
      );
    } catch (_error) {
      return new Map();
    }
  }

  function saveManualPositions() {
    try {
      environment.saveManualPositions?.(pageKey, Object.fromEntries(state.manualPositions));
    } catch (_error) {
      // Annotation dragging remains available in memory when page storage is unavailable.
    }
  }

  function saveAnnotations() {
    const annotations = state.annotations.map((annotation) => ({ ...annotation }));
    return Promise.resolve(environment.saveAnnotations?.(pageKey, annotations));
  }

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
      "element-select": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-dashed-mouse-pointer-icon lucide-square-dashed-mouse-pointer"><path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"/><path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M9 3h1"/><path d="M9 21h2"/><path d="M14 3h1"/><path d="M3 9v1"/><path d="M21 9v2"/><path d="M3 14v1"/></svg>',
      highlighter: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-highlighter-icon lucide-highlighter"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>',
      close: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
      "arrow-right": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right-icon lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
      link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
      share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4m-7.6 6.8 7.6 4.4"/></svg>',
      screenshot: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-fullscreen-icon lucide-fullscreen"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="8" x="7" y="8" rx="1"/></svg>',
      download: '<svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/></svg>',
      copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4m0 3h.01"/></svg>',
      cursor: '<svg viewBox="0 0 24 24"><path d="m5 3 14 9-6 1-3 6L5 3Z"/></svg>',
    };
    return icons[name] || "";
  }

  function excalifontFontFaces() {
    return EXCALIFONT_SUBSETS.map(({ file, range }) => `
      @font-face {
        font-family: "Excalifont";
        src: url("${assetUrl(`fonts/${file}`)}") format("woff2");
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        unicode-range: ${range};
      }
    `).join("");
  }

  function styles() {
    return `
      ${excalifontFontFaces()}
      :host { all: initial; --navy: #111a2e; --ink: #222b3e; --muted: #667085; --blue: #405cf5; --blue-dark: #2e48e8; --blue-pale: #edf3ff; --pink: #fff1f3; --line: #e7eaf0; --ink-black: #000000; --snow: #ffffff; --canvas: #f8f8f8; --fog: #efefef; --pebble: #d9d9d9; --graphite: #636363; --slate: #959595; --steel: #aeaeae; --ash: #7c7c7c; --annotation-color: #405cf5; --annotation-fg: #ffffff; --annotation-outline: #405cf5; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--navy); }
      *, *::before, *::after { box-sizing: border-box; }
      button { font: inherit; }
      button { color: inherit; }
      svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      .dock { position: fixed; z-index: 2147483645; right: 22px; bottom: 22px; width: 360px; opacity: 0; transform: translateX(calc(100% + 32px)); transition: transform .28s cubic-bezier(.22, 1, .36, 1), opacity .18s ease; filter: drop-shadow(0 18px 40px rgba(20, 29, 50, .16)); }
      .dock.is-visible { opacity: 1; transform: translateX(0); }
      .launcher { position: fixed; z-index: 2147483645; right: 22px; bottom: 22px; width: 58px; height: 58px; padding: 6px; border: 1px solid rgba(17,26,46,.08); border-radius: 17px 17px 17px 5px; display: grid; place-items: center; background: var(--snow); opacity: 0; transform: translateY(calc(100% + 32px)); cursor: pointer; box-shadow: 0 12px 30px rgba(20,29,50,.18); transition: transform .28s cubic-bezier(.22, 1, .36, 1), opacity .18s ease; }
      .launcher.is-visible { opacity: 1; transform: translateY(0); }
      .launcher:hover { transform: translateY(-2px); }
      .launcher:focus-visible { outline: 2px solid rgba(64,92,245,.34); outline-offset: 3px; }
      .launcher-mark { width: 44px; height: 44px; display: block; }
      .toolbar { width: max-content; min-height: 68px; margin-left: auto; padding: 12px; border: 1px solid rgba(17,26,46,.08); background: #fff; border-radius: 18px 18px 18px 4.5px; display: flex; align-items: center; gap: 8px; box-shadow: 0 3px 12px rgba(20,29,50,.07); transition: opacity .18s ease; }
      .brand-mark { flex: 0 0 auto; width: 42px; height: 42px; display: block; }
      .toolbar-action { flex: 0 0 auto; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; background: rgba(0,0,0,.05); color: var(--ash); display: grid; place-items: center; cursor: pointer; transition: background .16s ease, color .16s ease; }
      .toolbar-action:hover:not(:disabled) { background: rgba(0,0,0,.10); color: var(--ink-black); }
      .toolbar-action:focus-visible, .ghost-icon:focus-visible, .preview-action:focus-visible, .preview-copy:focus-visible { outline: 2px solid rgba(64,92,245,.34); outline-offset: 2px; }
      .toolbar-action:disabled { opacity: .48; cursor: wait; }
      .toolbar-action.is-unavailable:disabled, .page-comment-action.is-unavailable:disabled { cursor: not-allowed; }
      .toolbar-action svg { width: 21px; height: 21px; }
      .color-button { flex: 0 0 auto; width: 28px; height: 28px; padding: 0; border: 2px solid var(--snow); border-radius: 50%; background: var(--annotation-color); cursor: pointer; box-shadow: 0 0 0 1px rgba(17,26,46,.14), 0 4px 10px rgba(17,26,46,.12); transition: transform .16s ease, box-shadow .16s ease, background .16s ease; }
      .color-button:hover:not(:disabled) { transform: scale(1.04); box-shadow: 0 0 0 2px rgba(17,26,46,.18), 0 6px 13px rgba(17,26,46,.15); }
      .color-button:focus-visible, .color-button.is-active { outline: none; box-shadow: 0 0 0 3px var(--snow), 0 0 0 5px var(--navy); }
      .color-button:disabled { opacity: .48; cursor: wait; }
      .start-button.is-active, .highlighter-button.is-active { background: var(--navy); color: var(--snow); box-shadow: 0 5px 12px rgba(17,26,46,.22); }
      .start-button.is-active:hover:not(:disabled), .highlighter-button.is-active:hover:not(:disabled) { background: #050a15; color: var(--snow); }
      .capture-preview, .color-picker { position: relative; width: 100%; margin-bottom: 10px; padding: 10px; overflow: hidden; border: 1px solid rgba(17,26,46,.08); border-radius: 20px; background: var(--snow); opacity: 0; transform: translateY(8px) scale(.99); transition: opacity .18s ease, transform .2s cubic-bezier(.22, 1, .36, 1); box-shadow: 0 16px 44px rgba(17,26,46,.16); }
      .capture-preview.is-visible, .color-picker.is-visible { opacity: 1; transform: translateY(0) scale(1); }
      .preview-image-shell { position: relative; overflow: hidden; min-height: 132px; max-height: min(280px, 42vh); border-radius: 13px; display: grid; place-items: center; background: var(--fog); }
      .preview-image { display: block; width: 100%; height: auto; max-height: min(280px, 42vh); object-fit: contain; }
      .ghost-icon { width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.88); color: var(--graphite); cursor: pointer; box-shadow: 0 3px 10px rgba(17,26,46,.12); }
      .preview-close { position: absolute; z-index: 2; top: 17px; right: 17px; }
      .ghost-icon:hover { background: var(--snow); color: var(--ink-black); }
      .preview-actions { position: absolute; z-index: 2; right: 10px; bottom: 10px; display: flex; gap: 6px; }
      .preview-action { width: 32px; height: 32px; padding: 0; border: 1px solid rgba(17,26,46,.08); border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.9); color: var(--graphite); cursor: pointer; box-shadow: 0 3px 10px rgba(17,26,46,.14); backdrop-filter: blur(5px); }
      .preview-action:hover:not(:disabled) { background: var(--snow); color: var(--ink-black); }
      .preview-action:disabled { opacity: .46; cursor: not-allowed; }
      .preview-action svg { width: 15px; height: 15px; }
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
      .target-outline { display: none; position: fixed; z-index: 2147483643; pointer-events: none; border: 2px solid var(--annotation-outline); border-radius: 5px; background: transparent; box-shadow: none; transition: left .04s, top .04s, width .04s, height .04s, border-color .16s ease; }
      .pins { position: absolute; left: 0; top: 0; z-index: 2147483644; pointer-events: none; }
      .annotation-connector { position: absolute; z-index: 0; display: block; overflow: visible; pointer-events: none; }
      .annotation-connector path { fill: none; stroke: var(--annotation-outline); stroke-width: 1.75; stroke-linecap: round; vector-effect: non-scaling-stroke; transition: stroke .16s ease; }
      .element-highlight { position: absolute; z-index: 1; pointer-events: none; border: 1.5px solid var(--annotation-outline); border-radius: 5px; background: transparent; box-shadow: none; transition: border-color .16s ease; }
      .pins.is-exiting .element-highlight, .pins.is-exiting .annotation-connector { opacity: 0; transition: opacity .2s ease; }
      .annotation-stack { position: absolute; z-index: 2; width: max-content; max-width: calc(100vw - 16px); display: flex; flex-direction: column; align-items: flex-start; gap: 7px; pointer-events: none; }
      .annotation-stack[data-action-side="left"] { align-items: flex-end; }
      .annotation-stack.is-dragging { z-index: 3; }
      .page-comment-row { width: max-content; max-width: 100%; min-height: 24px; }
      .page-comment-row.is-revealing { animation: annotation-reveal .28s cubic-bezier(.22, 1, .36, 1) both; animation-delay: var(--reveal-delay, 0ms); }
      .page-comment { width: max-content; max-width: 100%; min-height: 24px; padding: 0; border: 0; border-radius: 0; display: flex; align-items: flex-start; gap: 6px; background: transparent; color: var(--annotation-color); text-align: left; box-shadow: none; transition: color .16s ease; }
      .annotation-stack[data-action-side="left"] .page-comment { flex-direction: row-reverse; }
      .page-comment-row.is-exiting { pointer-events: none; animation: annotation-dismiss .22s cubic-bezier(.55, 0, 1, .45) both; animation-delay: var(--exit-delay, 0ms); }
      .page-comment-actions { flex: 0 0 auto; display: flex; flex-direction: row; align-items: center; gap: 3px; pointer-events: auto; }
      .page-comment-action { width: 24px; height: 24px; padding: 0; border: 1px solid rgba(17,26,46,.10); border-radius: 7px; display: grid; place-items: center; color: var(--graphite); background: rgba(255,255,255,.92); cursor: pointer; box-shadow: 0 2px 7px rgba(17,26,46,.11); backdrop-filter: blur(8px); transition: background .16s ease, color .16s ease, transform .16s ease, opacity .16s ease; }
      .page-comment-action:hover:not(:disabled) { background: var(--snow); color: var(--ink-black); transform: translateY(-1px); }
      .page-comment-action:focus-visible { outline: 2px solid rgba(64,92,245,.38); outline-offset: 1px; }
      .page-comment-action:disabled { opacity: .58; cursor: wait; }
      .page-comment-action svg { width: 18px; height: 18px; stroke-width: 1.75; }
      .page-comment-copy { flex: 0 1 auto; display: block; width: max-content; min-width: 0; max-width: min(340px, calc(100vw - 73px)); font-family: "Excalifont", "Marker Felt", "Segoe Print", "Comic Sans MS", cursive; font-size: 16px; font-style: normal; font-weight: 400; line-height: 1.3; font-synthesis: none; overflow-wrap: anywhere; white-space: pre-wrap; padding: 0 5px; background: white; border: 1px solid rgba(0,0,0,0.05); border-radius: 5px; pointer-events: auto; cursor: move; user-select: none; touch-action: none; }
      .page-comment-copy[contenteditable="plaintext-only"], .page-comment-copy[contenteditable="true"] { min-width: 80px; cursor: text; user-select: text; touch-action: manipulation; outline: 1px dashed var(--annotation-color); outline-offset: 1px; }
      .annotation-stack.is-dragging .page-comment-copy { cursor: grabbing; }
      .has-tooltip { position: relative; }
      .has-tooltip::before, .has-tooltip::after { position: absolute; left: 50%; opacity: 0; pointer-events: none; transition: opacity .2s ease, transform .2s ease; }
      .has-tooltip::before { content: ""; z-index: 3; bottom: calc(100% + 6px); width: 9px; height: 9px; border-radius: 2px; background: var(--navy); transform: translate(-50%, 7px) rotate(45deg); }
      .has-tooltip::after { content: attr(aria-label); z-index: 4; bottom: calc(100% + 10px); width: max-content; max-width: min(240px, calc(100vw - 24px)); padding: 10px 14px; border-radius: 10px; background: var(--navy); color: #fff; font-size: 12px; font-weight: 650; line-height: 1.2; text-align: center; white-space: normal; box-shadow: 0 10px 30px rgba(17,26,46,.25); transform: translate(-50%, 7px); }
      .has-tooltip:hover::before, .has-tooltip:focus-visible::before { opacity: 1; transform: translate(-50%, 0) rotate(45deg); }
      .has-tooltip:hover::after, .has-tooltip:focus-visible::after { opacity: 1; transform: translate(-50%, 0); }
      .toast { position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translate(-50%, 20px); padding: 10px 14px; border-radius: 10px; background: var(--navy); color: #fff; font-size: 12px; font-weight: 650; opacity: 0; pointer-events: none; transition: .2s ease; box-shadow: 0 10px 30px rgba(17,26,46,.25); }
      .toast.show { opacity: 1; transform: translate(-50%, 0); }
      :host(.is-capturing) .dock, :host(.is-capturing) .toast { opacity: 0 !important; pointer-events: none !important; }
      :host(.is-capturing) .page-comment-actions { display: none !important; }
      :host(.is-capturing) .page-comment-copy:empty { display: none !important; }
      :host(.is-capturing-note) .element-highlight, :host(.is-capturing-note) .annotation-stack, :host(.is-capturing-note) .annotation-connector { visibility: hidden !important; }
      :host(.is-capturing-note) .annotation-stack.is-capture-target, :host(.is-capturing-note) .annotation-connector.is-capture-target { visibility: visible !important; }
      :host(.is-capturing-note) .annotation-stack.is-capture-target .page-comment-row { display: none; }
      :host(.is-capturing-note) .annotation-stack.is-capture-target .page-comment-row.is-capture-target { display: block; animation: none; }
      :host(.is-capturing-note) .target-outline { visibility: visible !important; border: 2px solid var(--annotation-color); background: transparent; box-shadow: none; transition: none; }
      :host(.is-capturing-viewport) .target-outline { visibility: hidden !important; }
      [hidden] { display: none !important; }
      @keyframes annotation-reveal { from { opacity: 0; transform: translateY(7px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes annotation-dismiss { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(7px) scale(.985); } }
      @keyframes a-pulse { 50% { box-shadow: 0 0 0 7px rgba(64,92,245,.16), 0 11px 28px rgba(17,26,46,.2); } }
      @media (max-width: 520px) {
        .dock { right: 10px; bottom: 10px; width: calc(100vw - 20px); }
        .launcher { right: 10px; bottom: 10px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dock, .launcher, .capture-preview, .color-picker, .toolbar { transition-duration: .01ms; }
        .page-comment-row, .page-comment-row.is-exiting { animation-duration: .01ms; animation-delay: 0ms; }
        .has-tooltip::before, .has-tooltip::after { transition-duration: .01ms; }
      }
    `;
  }
  }

  return { mount };
});
