import { mountLandingDemo } from "./landing-demo";
import { expect, test } from "vitest";

function renderLandingTargets(): void {
  document.body.innerHTML = `
    <h1 id="landing-hero-title">Leave feedback where it <span id="hero-title-anchor-word">matters</span></h1>
    <h2 id="landing-demo-title">We write it down. You look brilliant.</h2>
    <p id="landing-demo-description">A profesional note-taker comes to your desk, captures every thoguht, and never aks why it couldn’t be an email.</p>
    <img id="landing-demo-image" alt="A professional note-taker at a desk">
    <p><span id="highlighted-text">Highlight text</span> or elements.</p>
    <a id="landing-install-cta" href="#install">Use for free</a>
  `;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

test("homepage demo mounts seeded document and widget annotations as a resettable sandbox", async () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      const minimum = /min-width:\s*(\d+)px/.exec(query);
      const maximum = /max-width:\s*(\d+)px/.exec(query);
      const matches = !query.includes("prefers-reduced-motion")
        && (!minimum || window.innerWidth >= Number(minimum[1]))
        && (!maximum || window.innerWidth <= Number(maximum[1]));
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      };
    },
  });
  renderLandingTargets();
  Object.defineProperty(
    document.querySelector("#landing-demo-image"),
    "getBoundingClientRect",
    {
      configurable: true,
      value: () => ({
        left: 520,
        top: 150,
        right: 960,
        bottom: 510,
        width: 440,
        height: 360,
        x: 520,
        y: 150,
        toJSON: () => ({}),
      }),
    },
  );
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value(this: Range) {
      const isDemoDescription = this.toString().startsWith("A profesional note-taker");
      const top = isDemoDescription ? 200 : 100;
      const width = isDemoDescription ? 305 : 80;
      const height = isDemoDescription ? 28 : 20;
      return {
        left: 100,
        top,
        right: 100 + width,
        bottom: top + height,
        width,
        height,
        x: 100,
        y: top,
        toJSON: () => ({}),
      };
    },
  });
  const highlightRegistry = new Map<string, unknown>();
  Object.defineProperty(globalThis, "Highlight", {
    configurable: true,
    value: class {
      ranges: Range[];

      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    },
  });
  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    value: {
      highlights: {
        delete: (name: string) => highlightRegistry.delete(name),
        set: (name: string, highlight: unknown) => highlightRegistry.set(name, highlight),
      },
    },
  });

  const first = mountLandingDemo();
  await first.ready;
  await nextFrame();

  expect(first.status()).toMatchObject({ active: true, count: 6 });
  const firstHost = document.querySelector<HTMLElement>("#a-demo-root");
  const firstShadow = firstHost?.shadowRoot;
  expect(firstShadow).not.toBeNull();
  expect(
    [...firstShadow!.querySelectorAll(".page-comment-copy")].map((element) => element.textContent),
  ).toEqual(expect.arrayContaining([
    "Like this!",
    "Like this",
    "Change this image",
    "Fix these typos",
    "Try it on this page",
    "Simply add to Chrome\nand use on any page",
  ]));
  [
    "landing-like-this",
    "landing-change-image",
    "landing-fix-typos",
    "landing-add-button",
    "landing-install",
    "landing-highlight-text",
  ].forEach((id) => {
    expect(
      firstShadow!.querySelector(`[data-anchor="${id}"]`)?.getAttribute("data-placement"),
    ).toBe("manual");
  });
  expect(firstShadow!.querySelector('[data-highlight="landing-highlight-text"]')).toBeNull();
  const imageComment = firstShadow!.querySelector<HTMLElement>(
    '[data-anchor="landing-change-image"]',
  );
  Object.defineProperty(imageComment, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      right: 160,
      bottom: 24,
      width: 160,
      height: 24,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  window.dispatchEvent(new Event("resize"));
  expect(imageComment?.style.left).toBe("325px");
  expect(imageComment?.style.top).toBe("173px");
  expect(imageComment?.dataset.actionSide).toBe("left");
  expect(firstShadow!.querySelector<HTMLElement>(
    '[data-highlight="landing-change-image"]',
  )?.style).toMatchObject({
    left: "515px",
    top: "145px",
    width: "450px",
    height: "370px",
  });
  const typoComment = firstShadow!.querySelector<HTMLElement>(
    '[data-anchor="landing-fix-typos"]',
  );
  expect(typoComment?.style.left).toBe("255px");
  expect(typoComment?.style.top).toBe("260px");
  const textHighlight = highlightRegistry.get("a-demo-root-text") as
    | { ranges: Range[] }
    | undefined;
  expect(textHighlight?.ranges).toHaveLength(2);
  expect(textHighlight?.ranges.map((range) => range.toString())).toEqual(expect.arrayContaining([
    "Highlight text",
    "A profesional note-taker comes to your desk, captures every thoguht, and never aks why it couldn’t be an email.",
  ]));

  const viewportCapture = firstShadow!.querySelector<HTMLButtonElement>(".screenshot-button");
  const noteCapture = firstShadow!.querySelector<HTMLButtonElement>(
    '[data-page-capture="landing-like-this"]',
  );
  expect(viewportCapture?.disabled).toBe(true);
  expect(noteCapture?.disabled).toBe(true);
  expect(viewportCapture?.getAttribute("aria-label")).toContain("available in the Chrome extension");
  expect(firstShadow!.querySelector('[data-anchor="landing-single-screenshot"]')).toBeNull();
  expect(firstShadow!.querySelector('[data-anchor="landing-viewport-screenshot"]')).toBeNull();
  const sample = firstShadow!.querySelector<HTMLElement>(
    '[data-anchor="landing-add-button"]',
  );
  const sampleCopy = sample?.querySelector<HTMLElement>(".page-comment-copy");
  const sampleConnector = firstShadow!.querySelector<SVGElement>(
    '[data-connector="landing-add-button"]',
  );
  expect(sample).not.toBeNull();
  expect(sampleCopy).not.toBeNull();
  expect(sampleConnector).not.toBeNull();

  const responsiveSample = firstShadow!.querySelector<HTMLElement>(
    '[data-anchor="landing-like-this"]',
  );
  expect(responsiveSample?.style.left).toBe("65px");
  expect(responsiveSample?.style.top).toBe("35px");
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 700,
  });
  window.dispatchEvent(new Event("resize"));
  expect(responsiveSample?.style.left).toBe("120px");
  expect(responsiveSample?.style.top).toBe("-75px");
  expect(sample?.hidden).toBe(true);

  const tabletPosition = {
    left: responsiveSample?.style.left,
    top: responsiveSample?.style.top,
  };
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new Event("resize"));
  expect({
    left: responsiveSample?.style.left,
    top: responsiveSample?.style.top,
  }).toEqual(tabletPosition);
  expect(sample?.hidden).toBe(true);

  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 500,
  });
  window.dispatchEvent(new Event("resize"));
  expect(responsiveSample?.style.left).toBe("120px");
  expect(responsiveSample?.style.top).toBe("-75px");
  expect(sample?.hidden).toBe(true);

  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
  });
  window.dispatchEvent(new Event("resize"));
  expect(sample?.hidden).toBe(false);

  Object.defineProperty(sampleCopy!, "getBoundingClientRect", {
    configurable: true,
    value: () => {
      const left = Number.parseFloat(sample!.style.left) - window.scrollX;
      const top = Number.parseFloat(sample!.style.top) - window.scrollY;
      return {
        left,
        top,
        right: left + 220,
        bottom: top + 24,
        width: 220,
        height: 24,
        x: left,
        y: top,
        toJSON: () => ({}),
      };
    },
  });
  window.dispatchEvent(new Event("scroll"));
  const sampleTop = sample!.style.top;
  const connectorHeight = Number.parseFloat(sampleConnector!.style.height);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: 180,
  });
  window.dispatchEvent(new Event("scroll"));
  expect(sample!.style.top).toBe(sampleTop);
  expect(Number.parseFloat(sampleConnector!.style.height)).toBeGreaterThan(connectorHeight);
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: 0,
  });

  firstShadow!.querySelector<HTMLButtonElement>('[data-color-id="pink"]')?.click();
  expect(firstHost?.style.getPropertyValue("--annotation-color")).toBe("#db2777");
  expect(firstShadow!.querySelector<HTMLImageElement>(".launcher-mark")?.src).toContain(
    "a-pink.svg",
  );

  firstShadow!.querySelector<HTMLButtonElement>(".close-mode")?.click();
  await nextFrame();
  expect(first.status().active).toBe(false);
  expect(firstShadow!.querySelector(".launcher")?.classList.contains("is-visible")).toBe(true);

  firstShadow!.querySelector<HTMLButtonElement>(".launcher")?.click();
  await nextFrame();
  expect(first.status().active).toBe(true);
  expect(firstShadow!.querySelector(".dock")?.classList.contains("is-visible")).toBe(true);

  firstShadow!.querySelector<HTMLButtonElement>(
    '[data-page-delete="landing-like-this"]',
  )?.click();
  await Promise.resolve();
  expect(first.status().count).toBe(5);

  firstHost?.remove();
  renderLandingTargets();
  const reloaded = mountLandingDemo();
  await reloaded.ready;
  expect(reloaded.status()).toMatchObject({ active: true, count: 6 });
  expect(
    document.querySelector<HTMLElement>("#a-demo-root")
      ?.style.getPropertyValue("--annotation-color"),
  ).toBe("#405cf5");
});
