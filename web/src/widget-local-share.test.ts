import "./landing-demo";
import { beforeEach, expect, test, vi } from "vitest";

type WidgetController = {
  ready: Promise<void>;
};

type WidgetApi = {
  mount(options: Record<string, unknown>): WidgetController;
};

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.documentElement.querySelectorAll('[id^="local-share-test-"]').forEach((node) => node.remove());
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }),
  });
});

test("shares the locally captured JPEG File and exposes no copy-link field", async () => {
  const file = new File(["local-jpeg"], "a-note-viewport-example.jpg", {
    type: "image/jpeg",
  });
  const capture = vi.fn(async () => ({ ok: true, file }));
  const nativeShare = vi.fn(async () => undefined);
  const createObjectURL = vi.fn(() => "blob:local-preview");
  const revokeObjectURL = vi.fn();

  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: nativeShare,
  });
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: ({ files }: { files?: File[] }) => files?.[0] === file,
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });

  const widget = (globalThis as typeof globalThis & { ANoteWidget: WidgetApi }).ANoteWidget;
  const controller = widget.mount({
    hostId: "local-share-test-native",
    initialActive: true,
    launcher: false,
    seeds: [],
    environment: {
      capture,
      async loadAnnotations() {
        return [];
      },
      async saveAnnotations() {},
      async loadColor() {
        return "cobalt";
      },
      async saveColor() {},
      loadManualPositions() {
        return {};
      },
      saveManualPositions() {},
    },
  });
  await controller.ready;

  const shadow = document.querySelector<HTMLElement>("#local-share-test-native")!.shadowRoot!;
  shadow.querySelector<HTMLButtonElement>(".screenshot-button")!.click();
  await nextFrame();
  await nextFrame();
  await nextFrame();

  expect(capture).toHaveBeenCalledWith({ kind: "viewport" });
  expect(createObjectURL).toHaveBeenCalledWith(file);
  expect(shadow.querySelector<HTMLInputElement>(".preview-link")).toBeNull();
  expect(shadow.querySelector<HTMLButtonElement>(".preview-share")!.disabled).toBe(false);

  shadow.querySelector<HTMLButtonElement>(".preview-share")!.click();
  await Promise.resolve();
  expect(nativeShare).toHaveBeenCalledWith({ files: [file] });

  shadow.querySelector<HTMLButtonElement>(".preview-close")!.click();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-preview");
});

test("removes obsolete public-share fields from persisted annotations", async () => {
  document.body.innerHTML = '<button id="legacy-target">Target</button>';
  const saveAnnotations = vi.fn(async (
    _pageKey: string,
    _annotations: unknown[],
  ) => undefined);
  const widget = (globalThis as typeof globalThis & { ANoteWidget: WidgetApi }).ANoteWidget;
  const controller = widget.mount({
    hostId: "local-share-test-migration",
    initialActive: false,
    launcher: false,
    seeds: [],
    environment: {
      async loadAnnotations() {
        return [{
          id: "legacy-note",
          xpath: '//*[@id="legacy-target"]',
          content: "Still local",
          createdAt: "2026-01-01T00:00:00.000Z",
          shareId: "legacy-id",
          shareUrl: "https://example.test/s/legacy-id",
          screenshotUrl: "https://example.test/image.jpg",
          sharedAt: "2026-01-01T00:00:00.000Z",
        }];
      },
      saveAnnotations,
      async loadColor() {
        return "cobalt";
      },
      async saveColor() {},
      loadManualPositions() {
        return {};
      },
      saveManualPositions() {},
    },
  });
  await controller.ready;

  expect(saveAnnotations).toHaveBeenCalledTimes(1);
  const migrated = saveAnnotations.mock.calls[0][1] as Record<string, unknown>[];
  expect(migrated).toEqual([{
    id: "legacy-note",
    xpath: '//*[@id="legacy-target"]',
    content: "Still local",
    createdAt: "2026-01-01T00:00:00.000Z",
  }]);
});
