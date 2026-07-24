(function (root, factory) {
  const api = factory();
  root.AnnotateLib = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_CONTENT_LENGTH = 240;
  const SHARE_ID_PARAM = "annotateShare";
  const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
  const SHARE_COLOR_PARAM = "c";
  const SHARE_COLOR_TOKENS = Object.freeze([
    "cobalt",
    "indigo",
    "violet",
    "purple",
    "pink",
    "red",
    "orange",
    "yellow",
    "lime",
    "green",
    "teal",
    "slate",
  ]);

  function pageUrl(value) {
    const url = new URL(value);
    url.searchParams.delete(SHARE_ID_PARAM);
    return url.toString();
  }

  function sharePageUrl(origin, shareId, colorToken) {
    if (!isShareId(shareId)) throw new TypeError("Invalid share ID");
    const url = new URL(`/s/${shareId}`, ensureOrigin(origin));
    return withShareColor(url, colorToken);
  }

  function isShareId(value) {
    return SHARE_ID_PATTERN.test(String(value));
  }

  function isShareColorToken(value) {
    return SHARE_COLOR_TOKENS.includes(String(value));
  }

  function withShareColor(value, colorToken) {
    const url = new URL(value);
    if (isShareColorToken(colorToken)) {
      url.searchParams.set(SHARE_COLOR_PARAM, String(colorToken));
    } else {
      url.searchParams.delete(SHARE_COLOR_PARAM);
    }
    return url.toString();
  }

  function ensureOrigin(value) {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) throw new TypeError("Invalid web app origin");
    return url.origin;
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
    SHARE_COLOR_PARAM,
    SHARE_COLOR_TOKENS,
    SHARE_ID_PARAM,
    SHARE_ID_PATTERN,
    ensureOrigin,
    isShareColorToken,
    isShareId,
    pageUrl,
    sharePageUrl,
    withShareColor,
    xpathForElement,
    xpathLiteral,
  };
});
