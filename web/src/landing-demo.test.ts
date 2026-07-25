import { mountLandingDemo } from "./landing-demo";
import { expect, test } from "vitest";

function renderLandingTargets(): void {
  document.body.innerHTML = `
    <h1 id="landing-hero-title">Leave feedback where it <span id="hero-title-anchor-word">matters</span></h1>
    <h2 id="landing-demo-title">We write it down. You look brilliant.</h2>
    <p id="landing-demo-description">A professional note-taker comes to your desk, captures every thought, and never asks why it couldn’t be an email.</p>
    <a id="landing-install-cta" href="#install">Use for free</a>
  `;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

test("homepage demo mounts seeded document and widget annotations as a resettable sandbox", async () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }),
  });
  renderLandingTargets();

  const first = mountLandingDemo();
  await first.ready;
  await nextFrame();

  expect(first.status()).toMatchObject({ active: true, count: 4 });
  const firstHost = document.querySelector<HTMLElement>("#a-demo-root");
  const firstShadow = firstHost?.shadowRoot;
  expect(firstShadow).not.toBeNull();
  expect(
    [...firstShadow!.querySelectorAll(".page-comment-copy")].map((element) => element.textContent),
  ).toEqual(expect.arrayContaining([
    "Like this",
    "Use on any page",
    "Click + to try it out on this page",
    "Simply add to Chrome and use anywhere",
  ]));
  expect(
    [...firstShadow!.querySelectorAll(".annotation-stack")]
      .every((element) => element.getAttribute("data-placement") === "manual"),
  ).toBe(true);

  const viewportCapture = firstShadow!.querySelector<HTMLButtonElement>(".screenshot-button");
  const noteCapture = firstShadow!.querySelector<HTMLButtonElement>(
    '[data-page-share="landing-like-this"]',
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
  expect(responsiveSample?.style.left).toBe("255px");
  expect(responsiveSample?.style.top).toBe("35px");
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 700,
  });
  window.dispatchEvent(new Event("resize"));
  expect(responsiveSample?.style.left).toBe("55px");
  expect(responsiveSample?.style.top).toBe("25px");
  expect(sample?.style.left).toBe("-25px");
  expect(sample?.style.top).toBe("-315px");
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 500,
  });
  window.dispatchEvent(new Event("resize"));
  expect(responsiveSample?.style.left).toBe("15px");
  expect(responsiveSample?.style.top).toBe("51px");
  expect(sample?.style.left).toBe("15px");
  expect(sample?.style.top).toBe("-285px");
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 700,
  });
  window.dispatchEvent(new Event("resize"));
  expect(responsiveSample?.style.left).toBe("55px");
  expect(responsiveSample?.style.top).toBe("25px");
  expect(sample?.style.left).toBe("-25px");
  expect(sample?.style.top).toBe("-315px");
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 500,
  });
  window.dispatchEvent(new Event("resize"));
  expect(responsiveSample?.style.left).toBe("15px");
  expect(responsiveSample?.style.top).toBe("51px");
  expect(sample?.style.left).toBe("15px");
  expect(sample?.style.top).toBe("-285px");
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
  });
  window.dispatchEvent(new Event("resize"));

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
  expect(first.status().count).toBe(3);

  firstHost?.remove();
  renderLandingTargets();
  const reloaded = mountLandingDemo();
  await reloaded.ready;
  expect(reloaded.status()).toMatchObject({ active: true, count: 4 });
  expect(
    document.querySelector<HTMLElement>("#a-demo-root")
      ?.style.getPropertyValue("--annotation-color"),
  ).toBe("#405cf5");
});
