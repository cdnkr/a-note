(function (root, factory) {
  const api = factory();
  root.ANoteLayout = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const OUTLINE_PADDING = 5;
  const COMMENT_MAX_WIDTH = 340;
  const VIEWPORT_GUTTER = 8;
  const TARGET_SIDE_GAP = 10;
  const TARGET_BELOW_GAP = 8;
  const CONNECTOR_PADDING = 4;

  function expandRect(rect, padding = OUTLINE_PADDING) {
    const left = rect.left - padding;
    const top = rect.top - padding;
    const width = rect.width + padding * 2;
    const height = rect.height + padding * 2;
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    };
  }

  function commentLayout(rect, viewportWidth, noteWidth) {
    const width = Math.max(
      0,
      Math.min(noteWidth, viewportWidth - VIEWPORT_GUTTER * 2),
    );
    const rightFits = rect.right + TARGET_SIDE_GAP + width
      <= viewportWidth - VIEWPORT_GUTTER;
    const leftFits = rect.left - TARGET_SIDE_GAP - width
      >= VIEWPORT_GUTTER;

    if (rightFits) {
      return {
        left: rect.right + TARGET_SIDE_GAP,
        top: rect.top,
        width,
        placement: "right",
        actionSide: "right",
      };
    }

    if (leftFits) {
      return {
        left: rect.left - TARGET_SIDE_GAP - width,
        top: rect.top,
        width,
        placement: "left",
        actionSide: "left",
      };
    }

    const leftRoom = rect.left;
    const rightRoom = viewportWidth - rect.right;
    const actionSide = rightRoom >= leftRoom ? "right" : "left";
    const preferredLeft = actionSide === "right" ? rect.left : rect.right - width;
    const maximumLeft = viewportWidth - VIEWPORT_GUTTER - width;

    return {
      left: clamp(preferredLeft, VIEWPORT_GUTTER, Math.max(VIEWPORT_GUTTER, maximumLeft)),
      top: rect.bottom + TARGET_BELOW_GAP,
      width,
      placement: "below",
      actionSide,
    };
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function manualPositionMatchesViewport(position, viewportWidth) {
    return Boolean(
      position
      && Number.isFinite(position.left)
      && Number.isFinite(position.top)
      && Number.isFinite(position.screenWidth)
      && position.screenWidth === viewportWidth,
    );
  }

  function layoutViewportWidth(view = globalThis) {
    const candidates = [
      view?.innerWidth,
      view?.visualViewport?.width,
      view?.document?.documentElement?.clientWidth,
    ].filter((width) => Number.isFinite(width) && width > 0);
    if (!candidates.length) return 0;

    // Overflow can enlarge the layout viewport while the visible viewport stays
    // put (notably in responsive device emulation). Use the narrowest real
    // viewport measurement and normalize fractional zoom values for breakpoints.
    return Math.floor(Math.min(...candidates));
  }

  function responsivePosition(position, viewportWidth, matchMedia) {
    if (!position) return null;

    const { breakpoints, ...resolved } = position;
    if (!Array.isArray(breakpoints)) return resolved;

    const breakpoint = breakpoints.find((candidate) => {
      if (!candidate) return false;
      if (typeof matchMedia === "function") {
        const conditions = [];
        if (Number.isFinite(candidate.minWidth)) {
          conditions.push(`(min-width: ${candidate.minWidth}px)`);
        }
        if (Number.isFinite(candidate.maxWidth)) {
          conditions.push(`(max-width: ${candidate.maxWidth}px)`);
        }
        if (!conditions.length) return true;
        try {
          return Boolean(matchMedia(conditions.join(" and "))?.matches);
        } catch (_error) {
          // Fall back to the numeric viewport measurement below.
        }
      }
      const aboveMinimum = !Number.isFinite(candidate.minWidth)
        || viewportWidth >= candidate.minWidth;
      const belowMaximum = !Number.isFinite(candidate.maxWidth)
        || viewportWidth <= candidate.maxWidth;
      return aboveMinimum && belowMaximum;
    });

    if (Number.isFinite(breakpoint?.x)) resolved.x = breakpoint.x;
    if (Number.isFinite(breakpoint?.y)) resolved.y = breakpoint.y;
    if (typeof breakpoint?.show === "boolean") resolved.show = breakpoint.show;

    return resolved;
  }

  function setConnectorVisible(connector, visible) {
    if (!connector) return;
    connector.toggleAttribute("hidden", !visible);
  }

  function connectorGeometry(targetRect, annotationRect) {
    const target = normalizeRect(targetRect);
    const annotation = normalizeRect(annotationRect);
    const targetCenter = rectCenter(target);
    const annotationCenter = rectCenter(annotation);
    const horizontalRanges = closestRangePoints(
      target.top,
      target.bottom,
      annotation.top,
      annotation.bottom,
    );
    const verticalRanges = closestRangePoints(
      target.left,
      target.right,
      annotation.left,
      annotation.right,
    );
    const annotationIsRight = annotationCenter.x >= targetCenter.x;
    const annotationIsBelow = annotationCenter.y >= targetCenter.y;
    const horizontal = {
      start: {
        x: annotationIsRight ? target.right : target.left,
        y: horizontalRanges.first,
      },
      end: {
        x: annotationIsRight ? annotation.left : annotation.right,
        y: horizontalRanges.second,
      },
      targetSide: annotationIsRight ? "right" : "left",
      annotationSide: annotationIsRight ? "left" : "right",
      axis: "horizontal",
    };
    const vertical = {
      start: {
        x: verticalRanges.first,
        y: annotationIsBelow ? target.bottom : target.top,
      },
      end: {
        x: verticalRanges.second,
        y: annotationIsBelow ? annotation.top : annotation.bottom,
      },
      targetSide: annotationIsBelow ? "bottom" : "top",
      annotationSide: annotationIsBelow ? "top" : "bottom",
      axis: "vertical",
    };
    const horizontalDistance = pointDistanceSquared(horizontal.start, horizontal.end);
    const verticalDistance = pointDistanceSquared(vertical.start, vertical.end);
    const horizontalScale = Math.max(1, (target.width + annotation.width) / 2);
    const verticalScale = Math.max(1, (target.height + annotation.height) / 2);
    const horizontalBias = Math.abs(annotationCenter.x - targetCenter.x) / horizontalScale;
    const verticalBias = Math.abs(annotationCenter.y - targetCenter.y) / verticalScale;
    const closest = horizontalDistance === verticalDistance
      ? (horizontalBias >= verticalBias ? horizontal : vertical)
      : (horizontalDistance < verticalDistance ? horizontal : vertical);
    const deltaX = closest.end.x - closest.start.x;
    const deltaY = closest.end.y - closest.start.y;
    const distance = Math.hypot(deltaX, deltaY);
    const bow = clamp(distance * .12, 10, 32);
    let control1;
    let control2;

    if (closest.axis === "horizontal") {
      const bowDirection = deltaY >= 0 ? -1 : 1;
      control1 = {
        x: closest.start.x + deltaX * .35,
        y: closest.start.y + bow * bowDirection,
      };
      control2 = {
        x: closest.end.x - deltaX * .35,
        y: closest.end.y + bow * bowDirection,
      };
    } else {
      const bowDirection = deltaX >= 0 ? 1 : -1;
      control1 = {
        x: closest.start.x + bow * bowDirection,
        y: closest.start.y + deltaY * .35,
      };
      control2 = {
        x: closest.end.x + bow * bowDirection,
        y: closest.end.y - deltaY * .35,
      };
    }

    const points = [closest.start, control1, control2, closest.end];
    const left = Math.min(...points.map((point) => point.x)) - CONNECTOR_PADDING;
    const top = Math.min(...points.map((point) => point.y)) - CONNECTOR_PADDING;
    const right = Math.max(...points.map((point) => point.x)) + CONNECTOR_PADDING;
    const bottom = Math.max(...points.map((point) => point.y)) + CONNECTOR_PADDING;
    const local = points.map((point) => ({
      x: point.x - left,
      y: point.y - top,
    }));

    return {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
      path: `M ${formatNumber(local[0].x)} ${formatNumber(local[0].y)} C ${formatNumber(local[1].x)} ${formatNumber(local[1].y)}, ${formatNumber(local[2].x)} ${formatNumber(local[2].y)}, ${formatNumber(local[3].x)} ${formatNumber(local[3].y)}`,
      targetSide: closest.targetSide,
      annotationSide: closest.annotationSide,
      start: closest.start,
      end: closest.end,
      control1,
      control2,
    };
  }

  function normalizeRect(rect) {
    const left = Number(rect?.left) || 0;
    const top = Number(rect?.top) || 0;
    const right = Number.isFinite(rect?.right)
      ? rect.right
      : left + (Number(rect?.width) || 0);
    const bottom = Number.isFinite(rect?.bottom)
      ? rect.bottom
      : top + (Number(rect?.height) || 0);
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  function rectCenter(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function closestRangePoints(firstStart, firstEnd, secondStart, secondEnd) {
    const overlapStart = Math.max(firstStart, secondStart);
    const overlapEnd = Math.min(firstEnd, secondEnd);
    if (overlapStart <= overlapEnd) {
      const midpoint = (overlapStart + overlapEnd) / 2;
      return { first: midpoint, second: midpoint };
    }
    if (firstEnd < secondStart) {
      return { first: firstEnd, second: secondStart };
    }
    return { first: firstStart, second: secondEnd };
  }

  function pointDistanceSquared(first, second) {
    return (second.x - first.x) ** 2 + (second.y - first.y) ** 2;
  }

  function formatNumber(value) {
    return String(Math.round(value * 100) / 100);
  }

  return {
    COMMENT_MAX_WIDTH,
    CONNECTOR_PADDING,
    OUTLINE_PADDING,
    TARGET_BELOW_GAP,
    TARGET_SIDE_GAP,
    VIEWPORT_GUTTER,
    commentLayout,
    connectorGeometry,
    expandRect,
    layoutViewportWidth,
    manualPositionMatchesViewport,
    responsivePosition,
    setConnectorVisible,
  };
});
