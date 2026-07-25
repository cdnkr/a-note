import { beforeEach, describe, expect, it } from "vitest";
import {
  brandColorId,
  brandIconMarkup,
  brandIconUrl,
  updateBrandFavicon,
} from "./brand";

describe("brand icons", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("builds only canonical colour URLs", () => {
    expect(brandColorId("teal")).toBe("teal");
    expect(brandColorId("chartreuse")).toBe("cobalt");
    expect(brandIconUrl("orange")).toBe("/icons/a-orange.svg");
    expect(brandIconUrl("toString")).toBe("/icons/a-cobalt.svg");
    expect(brandIconMarkup("brand-mark", "yellow")).toContain(
      'class="brand-mark" src="/icons/a-yellow.svg" alt="" aria-hidden="true"',
    );
  });

  it("creates and updates the favicon for the selected colour", () => {
    updateBrandFavicon("teal");
    const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    expect(favicon?.getAttribute("href")).toBe("/icons/a-teal.svg");
    expect(favicon?.type).toBe("image/svg+xml");

    updateBrandFavicon("unknown");
    expect(document.querySelectorAll('link[rel~="icon"]')).toHaveLength(1);
    expect(favicon?.getAttribute("href")).toBe("/icons/a-cobalt.svg");
  });
});
