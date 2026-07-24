(function (root, factory) {
  const api = factory();
  root.AnnotateLib = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_CONTENT_LENGTH = 240;
  const SHARE_ID_PARAM = "annotateShare";
  const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

  function pageUrl(value) {
    const url = new URL(value);
    url.searchParams.delete(SHARE_ID_PARAM);
    return url.toString();
  }

  function readShareId(value) {
    const url = new URL(value);
    const id = url.searchParams.get(SHARE_ID_PARAM) || "";
    return isShareId(id) ? id : null;
  }

  function targetUrl(value, shareId) {
    if (!isShareId(shareId)) throw new TypeError("Invalid share ID");
    const url = new URL(pageUrl(value));
    url.searchParams.set(SHARE_ID_PARAM, shareId);
    return url.toString();
  }

  function sharePageUrl(origin, shareId) {
    if (!isShareId(shareId)) throw new TypeError("Invalid share ID");
    const url = new URL(`/s/${shareId}`, ensureOrigin(origin));
    return url.toString();
  }

  function isShareId(value) {
    return SHARE_ID_PATTERN.test(String(value));
  }

  function ensureOrigin(value) {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) throw new TypeError("Invalid web app origin");
    return url.origin;
  }

  function annotationFingerprint(annotation) {
    return `${annotation.xpath}\n${annotation.content}`;
  }

  function dedupeAnnotations(annotations) {
    const seenShareIds = new Set();
    const seenFingerprints = new Set();
    return annotations.filter((annotation) => {
      const fingerprint = annotationFingerprint(annotation);
      if (annotation.shareId && seenShareIds.has(annotation.shareId)) return false;
      if (seenFingerprints.has(fingerprint)) return false;
      if (annotation.shareId) seenShareIds.add(annotation.shareId);
      seenFingerprints.add(fingerprint);
      return true;
    });
  }

  function xpathLiteral(value) {
    const text = String(value);
    if (!text.includes("'")) return `'${text}'`;
    if (!text.includes('"')) return `"${text}"`;
    const parts = text.split("'");
    return `concat(${parts.map((part, index) => `${index ? `"'",` : ""}'${part}'`).join(",")})`;
  }

  function xpathForElement(element) {
    if (!element || element.nodeType !== 1) return "";
    if (element.id) {
      return `//*[@id=${xpathLiteral(element.id)}]`;
    }

    const parts = [];
    let current = element;
    while (current && current.nodeType === 1) {
      let index = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === current.tagName) index += 1;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      current = current.parentElement;
    }
    return `/${parts.join("/")}`;
  }

  return {
    MAX_CONTENT_LENGTH,
    SHARE_ID_PARAM,
    SHARE_ID_PATTERN,
    annotationFingerprint,
    dedupeAnnotations,
    ensureOrigin,
    isShareId,
    pageUrl,
    readShareId,
    sharePageUrl,
    targetUrl,
    xpathForElement,
    xpathLiteral,
  };
});
