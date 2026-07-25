import brandPalette from "../brand/palette.json";

const COLOR_IDS = new Set(brandPalette.colors.map((color) => color.id));

export function brandColorId(colorId?: string): string {
  return colorId && COLOR_IDS.has(colorId)
    ? colorId
    : brandPalette.defaultColorId;
}

export function brandIconUrl(colorId?: string): string {
  return `/icons/a-${brandColorId(colorId)}.svg`;
}

export function brandIconMarkup(className: string, colorId?: string): string {
  return `<img class="${className}" src="${brandIconUrl(colorId)}" alt="" aria-hidden="true">`;
}

export function updateBrandFavicon(colorId?: string, targetDocument = document): void {
  let favicon = targetDocument.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!favicon) {
    favicon = targetDocument.createElement("link");
    favicon.rel = "icon";
    targetDocument.head.append(favicon);
  }
  favicon.type = "image/svg+xml";
  favicon.href = brandIconUrl(colorId);
}
