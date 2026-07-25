(function (root, factory) {
  const api = factory();
  root.ANoteLib = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_CONTENT_LENGTH = 240;
  const SHARE_ID_PARAM = "aNoteShare";
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
  const XPATH_SEGMENT_SEPARATOR = "|";
  const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  const MAX_ANCESTOR_DEPTH = 10;
  const MAX_SIBLING_DISTANCE = 3;
  const SEMANTIC_TAGS = new Set([
    "main",
    "header",
    "footer",
    "nav",
    "aside",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "form",
    "search",
    "video",
    "audio",
    "canvas",
    "iframe",
    "table",
    "thead",
    "tbody",
    "tfoot",
  ]);
  const TEXT_ANCHOR_TAGS = new Set([
    "a",
    "button",
    "label",
    "legend",
    "summary",
    "option",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
  ]);
  const STABLE_ATTRIBUTES = Object.freeze([
    { name: "data-testid", score: 115 },
    { name: "data-test-id", score: 114 },
    { name: "data-test", score: 113 },
    { name: "data-cy", score: 112 },
    { name: "data-qa", score: 111 },
    { name: "data-automation-id", score: 110 },
    { name: "data-automationid", score: 110 },
    { name: "name", score: 96 },
    { name: "aria-label", score: 84 },
    { name: "role", score: 76 },
    { name: "placeholder", score: 68 },
  ]);
  const PREFERRED_DATA_ATTRIBUTE_PATTERN = /^data-(?:test|qa|cy|automation|component|element|hook)(?:-|$)/;
  const TEXT_QUOTE_CONTEXT_LENGTH = 32;

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
    const doc = element.ownerDocument;
    if (!doc || typeof doc.evaluate !== "function") {
      if (!element.id) return getAbsoluteXPath(element, null);
      return `//*[@id=${xpathLiteral(element.id)}]`;
    }

    const shadowPaths = [];
    let current = element;
    while (current && typeof current.getRootNode === "function") {
      const root = current.getRootNode();
      if (!isShadowRoot(root)) break;
      shadowPaths.unshift(xpathForElementInScope(current, root));
      current = root.host;
    }

    const documentPath = xpathForElementInScope(current, doc);
    return shadowPaths.length
      ? [documentPath, ...shadowPaths].join(XPATH_SEGMENT_SEPARATOR)
      : documentPath;
  }

  function xpathForElementInScope(element, scope) {
    if (isShadowRoot(scope)) return getAbsoluteXPath(element, scope);
    const prefix = xpathPrefix(scope);
    const directCandidates = dedupeAndValidateCandidates(
      collectDirectCandidates(element, scope, prefix, "target"),
      element,
      scope,
    );
    if (directCandidates[0]?.score > 74) return directCandidates[0].xpath;

    const fallbackCandidates = [
      ...collectAncestorCandidates(element, scope, prefix),
      ...collectSiblingCandidates(element, scope, prefix),
      {
        xpath: getAbsoluteXPath(element, scope),
        score: 0,
        strategy: "absolute",
      },
    ];
    const validFallbacks = dedupeAndValidateCandidates(fallbackCandidates, element, scope);
    const bestCandidate = [...directCandidates, ...validFallbacks].sort(compareCandidates)[0];
    return bestCandidate?.xpath || getAbsoluteXPath(element, scope);
  }

  function collectDirectCandidates(element, scope, prefix, role) {
    const candidates = [];
    const nodeTest = getNodeTest(element);

    if (isStableId(element.id)) {
      candidates.push({
        xpath: `${prefix}*[@id=${xpathLiteral(element.id)}]`,
        score: 120,
        strategy: "id",
      });
    }

    for (const attribute of stableAttributesForElement(element)) {
      candidates.push({
        xpath: `${prefix}${nodeTest}[@${attribute.name}=${xpathLiteral(attribute.value)}]`,
        score: attribute.score,
        strategy: "attribute",
      });
    }

    const tag = elementName(element);
    if (SEMANTIC_TAGS.has(tag) || tag.includes("-")) {
      candidates.push({
        xpath: `${prefix}${nodeTest}`,
        score: tag.includes("-") ? 102 : 105,
        strategy: "semantic",
      });
    }

    if (role === "target") {
      candidates.push(...collectLabelCandidates(element, scope, prefix));
    }

    if (hasStableText(element, role === "target")) {
      candidates.push({
        xpath: `${prefix}${nodeTest}[normalize-space(.)=${xpathLiteral(normalizedText(element))}]`,
        score: role === "target" ? 78 : 72,
        strategy: "text",
      });
    }

    candidates.push(...collectClassCandidates(element, prefix));
    return candidates;
  }

  function stableAttributesForElement(element) {
    const attributes = [];
    const seen = new Set();
    for (const attribute of STABLE_ATTRIBUTES) {
      const value = element.getAttribute?.(attribute.name);
      if (!isStableAttributeValue(attribute.name, value)) continue;
      seen.add(attribute.name);
      attributes.push({ ...attribute, value });
    }

    for (const attribute of Array.from(element.attributes || [])) {
      const name = String(attribute.name || "").toLowerCase();
      if (
        seen.has(name)
        || !PREFERRED_DATA_ATTRIBUTE_PATTERN.test(name)
        || !isStableAttributeValue(name, attribute.value)
      ) {
        continue;
      }
      attributes.push({ name, value: attribute.value, score: 104 });
    }
    return attributes;
  }

  function isStableAttributeValue(name, value) {
    const text = String(value || "").trim();
    if (!text || text.length > 160) return false;
    if (name === "role") return /^[a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*)*$/.test(text);
    if (name === "aria-label" || name === "placeholder") {
      return isStableTextValue(text, 100);
    }
    return !isLikelyGeneratedValue(text);
  }

  function isStableId(value) {
    const id = String(value || "").trim();
    if (!id || id.length > 128) return false;
    return !isLikelyGeneratedValue(id);
  }

  function isLikelyGeneratedValue(value) {
    const text = String(value);
    if (/^[0-9]+$/.test(text)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
      return true;
    }
    if (/(?:^|[-_])[0-9a-f]{10,}(?:$|[-_])/i.test(text)) return true;
    if (/^(?:ember|react|vue|mui|radix|headlessui|mantine)[-_:]?[a-z]*\d/i.test(text)) return true;
    if (/^:r[a-z0-9]+:$/i.test(text)) return true;
    if (/^(?:__next|__react|generated)[-_:]/i.test(text)) return true;
    if (/\d{5,}$/.test(text)) return true;
    return false;
  }

  function collectLabelCandidates(element, scope, prefix) {
    const candidates = [];
    const targetTest = getNodeTest(element);
    const labels = Array.from(element.labels || []);

    for (const label of labels) {
      const text = normalizedText(label);
      if (!isStableTextValue(text, 80)) continue;
      const labelPath = `${prefix}${getNodeTest(label)}[normalize-space(.)=${xpathLiteral(text)}]`;
      if (typeof label.contains === "function" && label.contains(element)) {
        const relativePath = relativeXPath(label, element);
        if (relativePath) {
          candidates.push({
            xpath: `${labelPath}/${relativePath}`,
            score: 92,
            strategy: "label",
          });
        }
      } else {
        candidates.push({
          xpath: `${labelPath}/following::${targetTest}[1]`,
          score: 88,
          strategy: "label",
        });
      }
    }

    const previous = element.previousElementSibling;
    const previousText = normalizedText(previous);
    if (previous && isStableTextValue(previousText, 60)) {
      const previousPath = `${prefix}${getNodeTest(previous)}[normalize-space(.)=${xpathLiteral(previousText)}]`;
      candidates.push({
        xpath: `${previousPath}/following-sibling::${targetTest}[1]`,
        score: 86,
        strategy: "label",
      });
    }

    return candidates;
  }

  function collectClassCandidates(element, prefix) {
    const nodeTest = getNodeTest(element);
    const classes = Array.from(element.classList || []).filter(isStableClass).slice(0, 4);
    if (!classes.length) return [];

    const candidates = classes.map((className) => ({
      xpath: `${prefix}${nodeTest}[${classPredicate([className])}]`,
      score: 42,
      strategy: "class",
    }));

    for (let left = 0; left < classes.length; left += 1) {
      for (let right = left + 1; right < classes.length; right += 1) {
        candidates.push({
          xpath: `${prefix}${nodeTest}[${classPredicate([classes[left], classes[right]])}]`,
          score: 38,
          strategy: "class",
        });
      }
    }

    if (classes.length > 2) {
      candidates.push({
        xpath: `${prefix}${nodeTest}[${classPredicate(classes)}]`,
        score: 34,
        strategy: "class",
      });
    }
    return candidates;
  }

  function isStableClass(value) {
    const className = String(value || "");
    if (!className || className.length > 80) return false;
    if (/[:[\]/]/.test(className)) return false;
    if (/^(?:css|sc|jsx)-[a-z0-9]{6,}$/i.test(className)) return false;
    if (/(?:^|[-_])[a-f0-9]{8,}(?:$|[-_])/i.test(className)) return false;
    if (/^[a-z0-9]{12,}$/i.test(className)) return false;
    return true;
  }

  function classPredicate(classes) {
    return classes.map((className) => (
      `contains(concat(' ', normalize-space(@class), ' '), ${xpathLiteral(` ${className} `)})`
    )).join(" and ");
  }

  function collectAncestorCandidates(element, scope, prefix) {
    const candidates = [];
    const relativeSegments = [];
    let current = element;
    let depth = 0;

    while (current?.parentElement && depth < MAX_ANCESTOR_DEPTH) {
      const parent = current.parentElement;
      if (typeof parent.getRootNode === "function" && parent.getRootNode() !== scope) break;
      depth += 1;
      relativeSegments.unshift(getIndexedStep(current));

      const anchors = bestDirectCandidates(parent, scope, prefix).slice(0, 3);
      for (const anchor of anchors) {
        candidates.push({
          xpath: `${anchor.xpath}/${relativeSegments.join("/")}`,
          score: Math.max(
            36,
            Math.min(74, anchor.score - 32 - ((depth - 1) * 3)),
          ),
          strategy: "ancestor",
        });
      }

      if (elementName(parent) === "body") break;
      current = parent;
    }
    return candidates;
  }

  function collectSiblingCandidates(element, scope, prefix) {
    const parent = element.parentElement;
    if (!parent || (typeof parent.getRootNode === "function" && parent.getRootNode() !== scope)) {
      return [];
    }

    const siblings = Array.from(parent.children || []);
    const targetIndex = siblings.indexOf(element);
    if (targetIndex < 0) return [];

    const candidates = [];
    const targetTest = getNodeTest(element);
    const firstIndex = Math.max(0, targetIndex - MAX_SIBLING_DISTANCE);
    const lastIndex = Math.min(siblings.length - 1, targetIndex + MAX_SIBLING_DISTANCE);

    for (let index = firstIndex; index <= lastIndex; index += 1) {
      if (index === targetIndex) continue;
      const sibling = siblings[index];
      const anchors = bestDirectCandidates(sibling, scope, prefix).slice(0, 2);
      const distance = Math.abs(index - targetIndex);
      const preceding = index < targetIndex;
      const axis = preceding ? "following-sibling" : "preceding-sibling";
      const occurrence = preceding
        ? countMatchingSiblings(siblings, index + 1, targetIndex, element)
        : countMatchingSiblings(siblings, targetIndex, index - 1, element);

      for (const anchor of anchors) {
        candidates.push({
          xpath: `${anchor.xpath}/${axis}::${targetTest}[${occurrence}]`,
          score: Math.max(30, Math.min(64, anchor.score - 52 - (distance * 2))),
          strategy: "sibling",
        });
      }
    }
    return candidates;
  }

  function countMatchingSiblings(siblings, from, to, target) {
    let count = 0;
    for (let index = from; index <= to; index += 1) {
      if (sameElementName(siblings[index], target)) count += 1;
    }
    return count;
  }

  function bestDirectCandidates(element, scope, prefix) {
    return dedupeAndValidateCandidates(
      collectDirectCandidates(element, scope, prefix, "anchor"),
      element,
      scope,
    );
  }

  function dedupeAndValidateCandidates(candidates, target, scope) {
    const seen = new Set();
    return candidates
      .filter((candidate) => {
        if (!candidate.xpath || seen.has(candidate.xpath)) return false;
        seen.add(candidate.xpath);
        return xpathMatchesElement(candidate.xpath, target, scope);
      })
      .sort(compareCandidates);
  }

  function compareCandidates(left, right) {
    if (left.score !== right.score) return right.score - left.score;
    const stepDifference = countXPathSteps(left.xpath) - countXPathSteps(right.xpath);
    if (stepDifference) return stepDifference;
    return left.xpath.length - right.xpath.length;
  }

  function xpathMatchesElement(xpath, element, scope) {
    const doc = element?.ownerDocument;
    if (!doc || typeof doc.evaluate !== "function") return false;
    try {
      const result = doc.evaluate(
        xpath,
        scope,
        null,
        xpathResultType(doc, "ORDERED_NODE_SNAPSHOT_TYPE", 7),
        null,
      );
      return result.snapshotLength === 1 && result.snapshotItem(0) === element;
    } catch (_error) {
      return false;
    }
  }

  function textTargetForRange(range) {
    if (!range || range.collapsed) return null;
    const doc = range.startContainer?.ownerDocument || range.endContainer?.ownerDocument;
    if (!doc || range.endContainer?.ownerDocument !== doc) return null;
    if (
      range.startContainer?.getRootNode?.() !== doc
      || range.endContainer?.getRootNode?.() !== doc
    ) {
      return null;
    }

    const commonAncestor = range.commonAncestorContainer;
    const rootElement = commonAncestor?.nodeType === 1
      ? commonAncestor
      : commonAncestor?.parentElement;
    if (!rootElement || rootElement.getRootNode?.() !== doc) return null;

    const rootXPath = xpathForElement(rootElement);
    const startOffset = textOffsetForBoundary(
      rootElement,
      range.startContainer,
      range.startOffset,
    );
    const endOffset = textOffsetForBoundary(
      rootElement,
      range.endContainer,
      range.endOffset,
    );
    const exact = String(range.toString?.() || "");
    if (
      !rootXPath
      || startOffset === null
      || endOffset === null
      || endOffset <= startOffset
      || !exact
    ) {
      return null;
    }

    const rootText = textContentForRangeRoot(rootElement);
    if (rootText.slice(startOffset, endOffset) !== exact) return null;

    return {
      type: "text",
      rootXPath,
      startOffset,
      endOffset,
      quote: {
        exact,
        prefix: rootText.slice(
          Math.max(0, startOffset - TEXT_QUOTE_CONTEXT_LENGTH),
          startOffset,
        ),
        suffix: rootText.slice(
          endOffset,
          endOffset + TEXT_QUOTE_CONTEXT_LENGTH,
        ),
      },
    };
  }

  function resolveTextTarget(target, doc = globalThis.document) {
    if (!isTextTarget(target) || !doc?.createRange) return null;
    const exact = target.quote.exact;
    const root = resolveXPath(target.rootXPath, doc);
    if (root) {
      const directRange = textRangeForOffsets(
        root,
        target.startOffset,
        target.endOffset,
        doc,
      );
      if (directRange?.toString() === exact) return directRange;

      const rootOffset = findTextQuoteOffset(
        textContentForRangeRoot(root),
        target.quote,
        target.startOffset,
      );
      if (rootOffset !== null) {
        const quoteRange = textRangeForOffsets(
          root,
          rootOffset,
          rootOffset + exact.length,
          doc,
        );
        if (quoteRange?.toString() === exact) return quoteRange;
      }
    }

    const fallbackRoot = doc.body;
    if (!fallbackRoot || fallbackRoot === root) return null;
    const fallbackOffset = findTextQuoteOffset(
      textContentForRangeRoot(fallbackRoot),
      target.quote,
      null,
    );
    if (fallbackOffset === null) return null;
    const fallbackRange = textRangeForOffsets(
      fallbackRoot,
      fallbackOffset,
      fallbackOffset + exact.length,
      doc,
    );
    return fallbackRange?.toString() === exact ? fallbackRange : null;
  }

  function isTextTarget(target) {
    return Boolean(
      target
      && target.type === "text"
      && typeof target.rootXPath === "string"
      && Number.isInteger(target.startOffset)
      && target.startOffset >= 0
      && Number.isInteger(target.endOffset)
      && target.endOffset > target.startOffset
      && target.quote
      && typeof target.quote.exact === "string"
      && target.quote.exact.length === target.endOffset - target.startOffset
      && typeof target.quote.prefix === "string"
      && typeof target.quote.suffix === "string",
    );
  }

  function textTargetKey(target) {
    if (!isTextTarget(target)) return "";
    return JSON.stringify([
      target.rootXPath,
      target.startOffset,
      target.endOffset,
      target.quote.exact,
    ]);
  }

  function findTextQuoteOffset(text, quote, expectedOffset = null) {
    const value = String(text || "");
    const exact = String(quote?.exact || "");
    const prefix = String(quote?.prefix || "");
    const suffix = String(quote?.suffix || "");
    if (!exact) return null;

    const matches = [];
    let searchOffset = 0;
    while (searchOffset <= value.length - exact.length) {
      const matchOffset = value.indexOf(exact, searchOffset);
      if (matchOffset < 0) break;
      const prefixStart = Math.max(0, matchOffset - prefix.length);
      const suffixEnd = matchOffset + exact.length + suffix.length;
      const prefixMatches = !prefix
        || value.slice(prefixStart, matchOffset) === prefix;
      const suffixMatches = !suffix
        || value.slice(matchOffset + exact.length, suffixEnd) === suffix;
      if (prefixMatches && suffixMatches) matches.push(matchOffset);
      searchOffset = matchOffset + 1;
    }
    if (matches.length === 1) return matches[0];
    if (!matches.length || !Number.isInteger(expectedOffset)) return null;
    const exactExpectedMatch = matches.filter((offset) => offset === expectedOffset);
    return exactExpectedMatch.length === 1 ? exactExpectedMatch[0] : null;
  }

  function textOffsetForBoundary(root, boundaryNode, boundaryOffset) {
    if (!root || !boundaryNode || !Number.isInteger(boundaryOffset)) return null;
    let total = 0;
    let resolved = null;

    function visit(node) {
      if (resolved !== null) return;
      if (node === boundaryNode) {
        if (node.nodeType === 3) {
          const length = String(node.nodeValue ?? node.textContent ?? "").length;
          if (boundaryOffset < 0 || boundaryOffset > length) return;
          resolved = total + boundaryOffset;
          return;
        }
        const children = Array.from(node.childNodes || []);
        if (boundaryOffset < 0 || boundaryOffset > children.length) return;
        for (let index = 0; index < boundaryOffset; index += 1) {
          total += textContentForRangeRoot(children[index]).length;
        }
        resolved = total;
        return;
      }
      if (node.nodeType === 3) {
        total += String(node.nodeValue ?? node.textContent ?? "").length;
        return;
      }
      for (const child of Array.from(node.childNodes || [])) {
        visit(child);
        if (resolved !== null) return;
      }
    }

    visit(root);
    return resolved;
  }

  function textRangeForOffsets(root, startOffset, endOffset, doc) {
    if (
      !root
      || !Number.isInteger(startOffset)
      || !Number.isInteger(endOffset)
      || startOffset < 0
      || endOffset <= startOffset
    ) {
      return null;
    }
    const start = textBoundaryForOffset(root, startOffset);
    const end = textBoundaryForOffset(root, endOffset);
    if (!start || !end) return null;
    try {
      const range = doc.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      return range;
    } catch (_error) {
      return null;
    }
  }

  function textBoundaryForOffset(root, targetOffset) {
    const textNodes = [];
    collectTextNodes(root, textNodes);
    let remaining = targetOffset;
    for (let index = 0; index < textNodes.length; index += 1) {
      const node = textNodes[index];
      const length = String(node.nodeValue ?? node.textContent ?? "").length;
      if (remaining < length || (remaining === length && index === textNodes.length - 1)) {
        return { node, offset: remaining };
      }
      if (remaining === length) {
        return { node: textNodes[index + 1], offset: 0 };
      }
      remaining -= length;
    }
    return null;
  }

  function textContentForRangeRoot(root) {
    if (!root) return "";
    if (root.nodeType === 3) {
      return String(root.nodeValue ?? root.textContent ?? "");
    }
    const textNodes = [];
    collectTextNodes(root, textNodes);
    return textNodes
      .map((node) => String(node.nodeValue ?? node.textContent ?? ""))
      .join("");
  }

  function collectTextNodes(node, output) {
    if (!node) return;
    if (node.nodeType === 3) {
      output.push(node);
      return;
    }
    for (const child of Array.from(node.childNodes || [])) {
      collectTextNodes(child, output);
    }
  }

  function resolveXPath(value, doc = globalThis.document) {
    if (!doc || typeof doc.evaluate !== "function") return null;
    const segments = splitCompoundXPath(value);
    if (!segments.length) return null;

    let scope = doc;
    let match = null;
    try {
      for (let index = 0; index < segments.length; index += 1) {
        if (isShadowRoot(scope)) {
          match = resolveShadowAbsoluteXPath(segments[index], scope);
        } else {
          const result = doc.evaluate(
            segments[index],
            scope,
            null,
            xpathResultType(doc, "FIRST_ORDERED_NODE_TYPE", 9),
            null,
          );
          match = result.singleNodeValue;
        }
        if (!match || match.nodeType !== 1) return null;
        if (index < segments.length - 1) {
          scope = match.shadowRoot;
          if (!scope) return null;
        }
      }
      return match;
    } catch (_error) {
      return null;
    }
  }

  function resolveShadowAbsoluteXPath(xpath, shadowRoot) {
    if (!xpath.startsWith("./")) return null;
    const steps = xpath.slice(2).split("/").filter(Boolean);
    let parent = shadowRoot;

    for (const step of steps) {
      const parsed = parseIndexedStep(step);
      if (!parsed) return null;
      const matches = Array.from(parent.children || [])
        .filter((child) => elementName(child) === parsed.name);
      parent = matches[parsed.index - 1];
      if (!parent) return null;
    }
    return parent?.nodeType === 1 ? parent : null;
  }

  function parseIndexedStep(step) {
    const htmlMatch = step.match(/^([a-z][a-z0-9_.-]*)\[(\d+)\]$/i);
    if (htmlMatch) {
      return { name: htmlMatch[1].toLowerCase(), index: Number(htmlMatch[2]) };
    }
    const namespacedMatch = step.match(/^\*\[local-name\(\)=['"]([^'"]+)['"]\]\[(\d+)\]$/i);
    if (namespacedMatch) {
      return { name: namespacedMatch[1].toLowerCase(), index: Number(namespacedMatch[2]) };
    }
    return null;
  }

  function splitCompoundXPath(value) {
    const text = String(value || "").trim();
    if (!text) return [];

    const segments = [];
    let start = 0;
    let quote = "";
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quote) {
        if (character === quote) quote = "";
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
      } else if (character === XPATH_SEGMENT_SEPARATOR) {
        segments.push(text.slice(start, index).trim());
        start = index + 1;
      }
    }
    segments.push(text.slice(start).trim());
    return segments.filter(Boolean);
  }

  function xpathResultType(doc, name, fallback) {
    return doc.defaultView?.XPathResult?.[name]
      ?? globalThis.XPathResult?.[name]
      ?? fallback;
  }

  function xpathPrefix(scope) {
    return isShadowRoot(scope) ? ".//" : "//";
  }

  function isShadowRoot(value) {
    return Boolean(value && value.nodeType === 11 && value.host);
  }

  function getAbsoluteXPath(element, scope) {
    if (!element || element.nodeType !== 1) return "";
    const segments = [];
    let current = element;
    while (current && current.nodeType === 1) {
      segments.unshift(getIndexedStep(current));
      if (isShadowRoot(scope) && current.parentNode === scope) break;
      current = current.parentElement;
    }
    return `${isShadowRoot(scope) ? "./" : "/"}${segments.join("/")}`;
  }

  function relativeXPath(ancestor, element) {
    const segments = [];
    let current = element;
    while (current && current !== ancestor) {
      segments.unshift(getIndexedStep(current));
      current = current.parentElement;
    }
    return current === ancestor ? segments.join("/") : "";
  }

  function getIndexedStep(element) {
    return `${getNodeTest(element)}[${getElementIndex(element)}]`;
  }

  function getElementIndex(element) {
    let index = 1;
    let sibling = element.previousElementSibling;
    while (sibling) {
      if (sameElementName(sibling, element)) index += 1;
      sibling = sibling.previousElementSibling;
    }
    return index;
  }

  function sameElementName(left, right) {
    return Boolean(
      left
      && right
      && elementName(left) === elementName(right)
      && (left.namespaceURI || "") === (right.namespaceURI || ""),
    );
  }

  function getNodeTest(element) {
    const name = elementName(element);
    return element.namespaceURI && element.namespaceURI !== XHTML_NAMESPACE
      ? `*[local-name()=${xpathLiteral(name)}]`
      : name;
  }

  function elementName(element) {
    return String(element?.localName || element?.tagName || "").toLowerCase();
  }

  function normalizedText(element) {
    return String(element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function hasStableText(element, requireSemanticTarget) {
    const tag = elementName(element);
    const role = String(element.getAttribute?.("role") || "").toLowerCase();
    if (
      requireSemanticTarget
      && !TEXT_ANCHOR_TAGS.has(tag)
      && !["button", "link", "tab", "menuitem", "option"].includes(role)
    ) {
      return false;
    }
    return isStableTextValue(normalizedText(element), 80);
  }

  function isStableTextValue(value, maximumLength) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length < 2 || text.length > maximumLength) return false;
    if (/^(?:https?:\/\/|mailto:)/i.test(text) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      return false;
    }
    if (/^[\d\s.,:/+-]+$/.test(text)) return false;
    if (/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(text)) {
      return false;
    }
    const digits = (text.match(/\d/g) || []).length;
    return digits / text.length <= 0.35;
  }

  function countXPathSteps(xpath) {
    let count = 0;
    let quote = "";
    for (let index = 0; index < xpath.length; index += 1) {
      const character = xpath[index];
      if (quote) {
        if (character === quote) quote = "";
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
      } else if (character === "/" && xpath[index - 1] !== "/") {
        count += 1;
      }
    }
    return count;
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
    isTextTarget,
    pageUrl,
    findTextQuoteOffset,
    resolveXPath,
    resolveTextTarget,
    sharePageUrl,
    splitCompoundXPath,
    textTargetForRange,
    textTargetKey,
    withShareColor,
    isStableClass,
    isStableId,
    xpathForElement,
    xpathLiteral,
  };
});
