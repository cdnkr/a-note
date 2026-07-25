(function (root) {
  "use strict";

  const COLOR_STORAGE_KEY = "a-note:annotation-color";
  const DEFAULT_COLOR_ID = "cobalt";
  const COLORS = Object.freeze([
    {
      "id": "cobalt",
      "label": "Cobalt",
      "value": "#405cf5",
      "darkValue": "#2945e8",
      "rgb": "64, 92, 245",
      "foreground": "#ffffff"
    },
    {
      "id": "indigo",
      "label": "Indigo",
      "value": "#4f46e5",
      "darkValue": "#4338ca",
      "rgb": "79, 70, 229",
      "foreground": "#ffffff"
    },
    {
      "id": "violet",
      "label": "Violet",
      "value": "#7c3aed",
      "darkValue": "#6d28d9",
      "rgb": "124, 58, 237",
      "foreground": "#ffffff"
    },
    {
      "id": "purple",
      "label": "Purple",
      "value": "#9333ea",
      "darkValue": "#7e22ce",
      "rgb": "147, 51, 234",
      "foreground": "#ffffff"
    },
    {
      "id": "pink",
      "label": "Pink",
      "value": "#db2777",
      "darkValue": "#be185d",
      "rgb": "219, 39, 119",
      "foreground": "#ffffff"
    },
    {
      "id": "red",
      "label": "Red",
      "value": "#dc2626",
      "darkValue": "#b91c1c",
      "rgb": "220, 38, 38",
      "foreground": "#ffffff"
    },
    {
      "id": "orange",
      "label": "Orange",
      "value": "#f97316",
      "darkValue": "#ea580c",
      "rgb": "249, 115, 22",
      "foreground": "#111a2e"
    },
    {
      "id": "yellow",
      "label": "Yellow",
      "value": "#facc15",
      "darkValue": "#eab308",
      "rgb": "250, 204, 21",
      "foreground": "#111a2e"
    },
    {
      "id": "lime",
      "label": "Lime",
      "value": "#84cc16",
      "darkValue": "#65a30d",
      "rgb": "132, 204, 22",
      "foreground": "#111a2e"
    },
    {
      "id": "green",
      "label": "Green",
      "value": "#059669",
      "darkValue": "#047857",
      "rgb": "5, 150, 105",
      "foreground": "#ffffff"
    },
    {
      "id": "teal",
      "label": "Teal",
      "value": "#0d9488",
      "darkValue": "#0f766e",
      "rgb": "13, 148, 136",
      "foreground": "#ffffff"
    },
    {
      "id": "slate",
      "label": "Slate",
      "value": "#344054",
      "darkValue": "#1d2939",
      "rgb": "52, 64, 84",
      "foreground": "#ffffff"
    }
  ].map((color) => Object.freeze(color)));
  const COLORS_BY_ID = new Map(COLORS.map((color) => [color.id, color]));

  function colorById(colorId) {
    return COLORS_BY_ID.get(String(colorId)) || COLORS_BY_ID.get(DEFAULT_COLOR_ID);
  }

  function svgPath(colorId) {
    return `icons/a-${colorById(colorId).id}.svg`;
  }

  function pngPaths(colorId) {
    const id = colorById(colorId).id;
    return Object.freeze({
      16: `icons/a-${id}-16.png`,
      24: `icons/a-${id}-24.png`,
      32: `icons/a-${id}-32.png`,
      48: `icons/a-${id}-48.png`,
      128: `icons/a-${id}-128.png`,
    });
  }

  root.ANoteBrand = Object.freeze({
    COLOR_STORAGE_KEY,
    DEFAULT_COLOR_ID,
    COLORS,
    colorById,
    svgPath,
    pngPaths,
  });
})(globalThis);
