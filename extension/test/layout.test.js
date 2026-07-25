const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const layoutPath = path.resolve(__dirname, "../src/layout.js");
vm.runInThisContext(fs.readFileSync(layoutPath, "utf8"), { filename: layoutPath });
const {
  OUTLINE_PADDING,
  VIEWPORT_GUTTER,
  commentLayout,
  connectorGeometry,
  expandRect,
  manualPositionMatchesViewport,
  setConnectorVisible,
} = globalThis.ANoteLayout;
delete globalThis.ANoteLayout;

test("expandRect surrounds every side with the configured outline padding", () => {
  assert.equal(OUTLINE_PADDING, 5);
  assert.deepEqual(
    expandRect({ left: 20, top: 30, width: 100, height: 40 }),
    { left: 15, top: 25, right: 125, bottom: 75, width: 110, height: 50 },
  );
});

test("commentLayout places a measured note to the right when it fits", () => {
  assert.deepEqual(
    commentLayout({ left: 100, top: 40, right: 200, bottom: 80 }, 1000, 120),
    { left: 210, top: 40, width: 120, placement: "right", actionSide: "right" },
  );
});

test("commentLayout mirrors the actions when the note fits to the left", () => {
  assert.deepEqual(
    commentLayout({ left: 800, top: 40, right: 900, bottom: 80 }, 1000, 120),
    { left: 670, top: 40, width: 120, placement: "left", actionSide: "left" },
  );
});

test("below-target notes put the actions on the roomier viewport side", () => {
  const leftTarget = commentLayout({ left: 40, top: 40, right: 100, bottom: 80 }, 420, 340);
  const rightTarget = commentLayout({ left: 320, top: 40, right: 380, bottom: 80 }, 420, 340);

  assert.equal(leftTarget.placement, "below");
  assert.equal(leftTarget.actionSide, "right");
  assert.equal(rightTarget.placement, "below");
  assert.equal(rightTarget.actionSide, "left");
});

test("narrow layouts clamp the measured note footprint inside the viewport", () => {
  const viewportWidth = 320;
  const layout = commentLayout(
    { left: 140, top: 40, right: 180, bottom: 80 },
    viewportWidth,
    400,
  );
  const footprintLeft = layout.left;
  const footprintRight = layout.left + layout.width;

  assert.equal(layout.width, 304);
  assert.ok(footprintLeft >= VIEWPORT_GUTTER);
  assert.ok(footprintRight <= viewportWidth - VIEWPORT_GUTTER);
});

test("manual positions only apply at the viewport width where they were saved", () => {
  const position = { left: 320, top: 180, screenWidth: 1440 };

  assert.equal(manualPositionMatchesViewport(position, 1440), true);
  assert.equal(manualPositionMatchesViewport(position, 1280), false);
  assert.equal(manualPositionMatchesViewport({ left: 1, top: 2 }, 1440), false);
});

test("connector visibility toggles an SVG-compatible hidden attribute", () => {
  const attributes = new Set();
  const connector = {
    toggleAttribute(name, force) {
      if (force) attributes.add(name);
      else attributes.delete(name);
    },
  };

  setConnectorVisible(connector, false);
  assert.equal(attributes.has("hidden"), true);

  setConnectorVisible(connector, true);
  assert.equal(attributes.has("hidden"), false);
});

test("connectorGeometry joins the closest facing sides with a curved path", () => {
  const connector = connectorGeometry(
    { left: 20, top: 40, right: 120, bottom: 100 },
    { left: 240, top: 50, right: 360, bottom: 90 },
  );

  assert.equal(connector.targetSide, "right");
  assert.equal(connector.annotationSide, "left");
  assert.deepEqual(connector.start, { x: 120, y: 70 });
  assert.deepEqual(connector.end, { x: 240, y: 70 });
  assert.notEqual(connector.control1.y, connector.start.y);
  assert.match(connector.path, /^M .+ C .+/);
  assert.ok(connector.width > 120);
});

test("connectorGeometry uses bottom and top sides for a note moved below its target", () => {
  const connector = connectorGeometry(
    { left: 100, top: 20, right: 220, bottom: 80 },
    { left: 110, top: 200, right: 230, bottom: 240 },
  );

  assert.equal(connector.targetSide, "bottom");
  assert.equal(connector.annotationSide, "top");
  assert.equal(connector.start.y, 80);
  assert.equal(connector.end.y, 200);
  assert.notEqual(connector.control1.x, connector.start.x);
});
