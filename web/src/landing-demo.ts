import "../../extension/src/brand.js";
import "../../extension/src/lib.js";
import "../../extension/src/layout.js";
import "../../extension/src/widget.js";

import excalifontLatinUrl from "../../extension/public/fonts/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2?url";
import excalifontExtendedUrl from "../../extension/public/fonts/Excalifont-Regular-be310b9bcd4f1a43f571c46df7809174.woff2?url";
import excalifontCyrillicUrl from "../../extension/public/fonts/Excalifont-Regular-b9dcf9d2e50a1eaf42fc664b50a3fd0d.woff2?url";
import excalifontGreekUrl from "../../extension/public/fonts/Excalifont-Regular-41b173a47b57366892116a575a43e2b6.woff2?url";
import excalifontSymbolsUrl from "../../extension/public/fonts/Excalifont-Regular-3f2c5db56cc93c5a6873b1361d730c16.woff2?url";
import excalifontCyrillicExtendedUrl from "../../extension/public/fonts/Excalifont-Regular-349fac6ca4700ffec595a7150a0d1e1d.woff2?url";
import excalifontMarksUrl from "../../extension/public/fonts/Excalifont-Regular-623ccf21b21ef6b3a0d87738f77eb071.woff2?url";

type AnnotationSeed = {
  id: string;
  root: "document" | "widget";
  selector: string;
  content: string;
  position: {
    x?: number;
    y?: number;
    actionSide?: "left" | "right";
    pagePinned?: boolean;
  };
};

type ANoteController = {
  ready: Promise<void>;
  setActive(active: boolean): void;
  toggle(): void;
  status(): { active: boolean; count: number; url: string };
};

type ANoteWidgetApi = {
  mount(options: {
    hostId: string;
    initialActive: boolean;
    launcher: boolean;
    seeds: AnnotationSeed[];
    environment: {
      assetUrl(path: string): string;
      loadAnnotations(pageKey: string): Promise<unknown[]>;
      saveAnnotations(pageKey: string, annotations: unknown[]): Promise<void>;
      loadColor(): Promise<string>;
      saveColor(colorId: string): Promise<void>;
      loadManualPositions(pageKey: string): Record<string, unknown>;
      saveManualPositions(pageKey: string, positions: Record<string, unknown>): void;
    };
  }): ANoteController;
};

const fontAssets: Record<string, string> = {
  "fonts/Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2": excalifontLatinUrl,
  "fonts/Excalifont-Regular-be310b9bcd4f1a43f571c46df7809174.woff2": excalifontExtendedUrl,
  "fonts/Excalifont-Regular-b9dcf9d2e50a1eaf42fc664b50a3fd0d.woff2": excalifontCyrillicUrl,
  "fonts/Excalifont-Regular-41b173a47b57366892116a575a43e2b6.woff2": excalifontGreekUrl,
  "fonts/Excalifont-Regular-3f2c5db56cc93c5a6873b1361d730c16.woff2": excalifontSymbolsUrl,
  "fonts/Excalifont-Regular-349fac6ca4700ffec595a7150a0d1e1d.woff2": excalifontCyrillicExtendedUrl,
  "fonts/Excalifont-Regular-623ccf21b21ef6b3a0d87738f77eb071.woff2": excalifontMarksUrl,
};

const seeds: AnnotationSeed[] = [
  {
    id: "landing-like-this",
    root: "document",
    selector: "#hero-title-anchor-word",
    content: "Like this",
    position: {
      y: 40,
      x: 240
    },
  },
  {
    id: "landing-use-any-page",
    root: "document",
    selector: "#landing-demo-title",
    content: "Use on any page",
    position: {
      y: -100,
      x: -200
    },
  },
  // {
  //   id: "landing-leave-note",
  //   root: "document",
  //   selector: "#landing-demo-description",
  //   content: "Highlight the element and simply leave a note",
  //   position: {
  //     y: 14,
  //   },
  // },
  {
    id: "landing-add-button",
    root: "widget",
    selector: ".start-button",
    content: "Click + to try it out on this page",
    position: {
      y: -350,
      actionSide: "left",
      pagePinned: true,
    },
  },
  {
    id: "landing-install",
    root: "document",
    selector: "#landing-install-cta",
    content: "Simply add to Chrome and use anywhere",
    position: {
      y: -10,
      x: -680,
      actionSide: "left"
    },
  },
];

export function mountLandingDemo(): ANoteController {
  const widget = (globalThis as typeof globalThis & { ANoteWidget: ANoteWidgetApi })
    .ANoteWidget;

  return widget.mount({
    hostId: "a-demo-root",
    initialActive: true,
    launcher: true,
    seeds,
    environment: {
      assetUrl(path) {
        return fontAssets[path] || `/${path}`;
      },
      async loadAnnotations() {
        return [];
      },
      async saveAnnotations() {
        // Homepage annotations intentionally last only until the page reloads.
      },
      async loadColor() {
        return "cobalt";
      },
      async saveColor() {
        // Homepage colour intentionally resets to cobalt on reload.
      },
      loadManualPositions() {
        return {};
      },
      saveManualPositions() {
        // Homepage positions intentionally reset to automatic placement on reload.
      },
    },
  });
}
