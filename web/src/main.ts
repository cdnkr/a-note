import "./styles.css";
import { CHROME_STORE_URL } from "./config";
import { mountLandingDemo } from "./landing-demo";
import {
  brandIconMarkup,
  updateBrandFavicon,
} from "./brand";
import {
  fetchShareRecord,
  ShareRequestError,
  shareColorFromSearch,
  shareIdFromPath,
  type ShareColor,
  type ShareRecord,
} from "./share-client";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("App root not found");

const shareRoute = location.pathname.startsWith("/s/");
const pageColor = shareColorFromSearch(shareRoute ? location.search : "");
updateBrandFavicon(pageColor.token);
if (shareRoute) {
  applyShareColor(pageColor);
  void renderSharePage(app);
} else {
  renderLandingPage(app);
}

function applyShareColor(color: ShareColor): void {
  document.documentElement.style.setProperty("--blue", color.value);
  document.documentElement.style.setProperty("--blue-dark", color.darkValue);
  document.documentElement.style.setProperty("--primary-rgb", color.rgb);
  document.documentElement.style.setProperty("--primary-foreground", color.foreground);
}

function brand(): string {
  return `<a class="brand" href="/" aria-label="A-Note home">${brandIconMarkup("brand-mark")}<span>A-Note</span></a>`;
}

function arrowIcon(): string {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4"/></svg>`;
}

function shareIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4m-7.6 6.8 7.6 4.4"/></svg>`;
}

function downloadIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/></svg>`;
}

function externalLinkIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;
}

function copyIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`;
}

function renderLandingPage(root: HTMLElement): void {
  document.title = "A-Note — Feedback, in context";
  root.classList.add("landing-page");
  root.innerHTML = `
    <header class="site-header shell">
      ${brand()}
      <a class="button button-small" href="${escapeAttribute(CHROME_STORE_URL)}">Get the extension ${arrowIcon()}</a>
    </header>

    <main>
      <section class="hero shell">
        <h1 id="landing-hero-title">Add notes in place, <br>on web <span id="hero-title-anchor-word">pages.</span></h1>
        <p><span id="highlighted-text">Highlight text</span> or elements, add comments, and share them as screenshots.</p>
        <div class="hero-actions">
          <a class="button" id="landing-install-cta" href="${escapeAttribute(CHROME_STORE_URL)}">Use for free ${arrowIcon()}</a>
        </div>

        <div class="product-stage" aria-label="A-Note extension preview">
          <div class="demo-shell">
            <div class="browser-frame">
              <div class="browser-bar">
                <span></span><span></span><span></span>
                <div class="browser-address">scribblestaff.co</div>
              </div>
              <div class="demo-page">
                <div class="demo-nav">
                  <b>scribble staff<span class="demo-logo-dot">.</span></b>
                  <span>How it works&nbsp;&nbsp;&nbsp;&nbsp; Pricing&nbsp;&nbsp;&nbsp;&nbsp; Alibis</span>
                  <i aria-hidden="true">Book a scribbler</i>
                </div>
                <div class="demo-copy">
                  <h2 id="landing-demo-title">We write it down.<br>You look brilliant.</h2>
                  <p id="landing-demo-description">A profesional note-taker comes to your desk, captures every thoguht, and never aks why it couldn’t be an email.</p>
                  <button type="button" tabindex="-1">Send someone over</button>
                </div>
                <div class="demo-illustration">
                  <img
                    id="landing-demo-image"
                    class="desk-scene"
                    src="/desk-scene.png"
                    alt="A professional note-taker writes at a desk while a smiling man relaxes in his chair."
                    width="440"
                    height="360"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer shell">
      <span>© ${new Date().getFullYear()} A-Note</span>
    </footer>
  `;
  mountLandingDemo();
}

async function renderSharePage(root: HTMLElement): Promise<void> {
  root.classList.remove("landing-page");
  setNoIndex();
  document.title = "Opening shared screenshot — A-Note";
  const shareId = shareIdFromPath(location.pathname);
  if (!shareId) {
    renderShareError(root, "That link doesn’t look right.", "Check the URL or ask the sender for a new share link.");
    return;
  }

    root.innerHTML = `
      <main class="share-loading shell" aria-live="polite">
        ${brandIconMarkup("loader-mark", pageColor.token)}
      <span class="loading-line"></span><span class="loading-line loading-line-short"></span>
      <p>Opening shared screenshot…</p>
    </main>`;

  try {
    const record = await fetchShareRecord(shareId);
    renderSharedScreenshot(root, record);
  } catch (error) {
    if (error instanceof ShareRequestError && error.status === 404) {
      renderShareError(root, "This share isn’t available.", "It may have been removed, or the link may be incomplete.");
      return;
    }
    renderShareError(root, "We couldn’t open this share.", "Please check your connection and try again.");
  }
}

function renderSharedScreenshot(root: HTMLElement, record: ShareRecord): void {
  document.title = "Shared screenshot — A-Note";
  const source = new URL(record.targetUrl);
  root.replaceChildren();

  const main = document.createElement("main");
  main.className = "share-view";

  const screenshot = document.createElement("figure");
  screenshot.className = "share-screenshot";
  const image = document.createElement("img");
  image.src = record.screenshotUrl;
  image.alt = "Shared A-Note screenshot";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    screenshot.classList.add("is-broken");
    screenshot.replaceChildren();
    const message = document.createElement("p");
    message.textContent = "The screenshot could not be displayed.";
    screenshot.append(message);
  }, { once: true });
  screenshot.append(image);

  const actions = document.createElement("div");
  actions.className = "share-actions";
  const context = document.createElement("p");
  context.className = "share-context";
    context.innerHTML = `
      <span>Shared with</span>
      ${brandIconMarkup("share-title-mark", pageColor.token)}
    <span>A-Note</span>
  `;
  const iconActions = document.createElement("div");
  iconActions.className = "share-icon-actions";
  const shareButton = shareIconButton("Share screenshot", shareIcon());
  const downloadButton = shareIconButton("Download screenshot", downloadIcon());
  const sourceLink = shareIconLink(`Go to ${source.hostname}`, record.targetUrl, externalLinkIcon());
  shareButton.addEventListener("click", () => void shareScreenshotPage(shareButton));
  downloadButton.addEventListener("click", () => void downloadSharedScreenshot(
    record.screenshotUrl,
    source.hostname,
    downloadButton,
  ));
  iconActions.append(shareButton, downloadButton, sourceLink);

  const urlField = document.createElement("div");
  urlField.className = "share-url-field";
  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.value = location.href;
  urlInput.readOnly = true;
  urlInput.setAttribute("aria-label", "Share page URL");
  urlInput.addEventListener("focus", () => urlInput.select());
  const copyButton = document.createElement("button");
  copyButton.className = "share-copy-button";
  copyButton.type = "button";
  copyButton.innerHTML = `${copyIcon()}<span>Copy</span>`;
  copyButton.addEventListener("click", () => void copyShareUrl(urlInput, copyButton));
  urlField.append(urlInput, copyButton);

  const install = actionLink("Get the extension", CHROME_STORE_URL, "button share-install-button");

  actions.append(context, iconActions, urlField, install);

  main.append(
    screenshot,
    actions
  );
  root.append(main);
}

function renderShareError(root: HTMLElement, title: string, copy: string): void {
  setNoIndex();
  document.title = `${title} — A-Note`;
  root.replaceChildren();
  const main = document.createElement("main");
  main.className = "share-error shell";
  main.innerHTML = `<span class="error-mark">!</span>`;
  const heading = document.createElement("h1");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = copy;
  main.append(heading, paragraph, actionLink("Back to A-Note", "/", "button"));
  root.append(main);
}

function actionLink(label: string, href: string, className: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
}

function shareIconButton(label: string, icon: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "share-icon-button";
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.innerHTML = icon;
  return button;
}

function shareIconLink(label: string, href: string, icon: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "share-icon-button";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", label);
  link.innerHTML = icon;
  return link;
}

async function copyShareUrl(input: HTMLInputElement, button: HTMLButtonElement): Promise<void> {
  const label = button.querySelector("span");
  if (!label) return;
  const originalLabel = label.textContent || "Copy";

  try {
    await navigator.clipboard.writeText(input.value);
    label.textContent = "Copied";
  } catch (_error) {
    input.select();
    label.textContent = document.execCommand("copy") ? "Copied" : "Try again";
  }

  window.setTimeout(() => {
    label.textContent = originalLabel;
  }, 1800);
}

async function shareScreenshotPage(button: HTMLButtonElement): Promise<void> {
  const shareData = {
    title: document.title,
    text: "Shared with A-Note",
    url: location.href,
  };
  try {
    const canShare = typeof navigator.share === "function"
      && (typeof navigator.canShare !== "function" || navigator.canShare(shareData));
    if (canShare) {
      await navigator.share(shareData);
      return;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
  }

  try {
    await navigator.clipboard.writeText(location.href);
    showTemporaryButtonStatus(button, "Link copied");
  } catch (_error) {
    showTemporaryButtonStatus(button, "Could not copy link");
  }
}

async function downloadSharedScreenshot(
  screenshotUrl: string,
  hostname: string,
  button: HTMLButtonElement,
): Promise<void> {
  button.disabled = true;
  try {
    const response = await fetch(screenshotUrl, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Screenshot download failed");
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `a-note-${hostname.replace(/[^a-z0-9]+/gi, "-") || "screenshot"}.jpg`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (_error) {
    showTemporaryButtonStatus(button, "Download failed");
  } finally {
    button.disabled = false;
  }
}

function showTemporaryButtonStatus(button: HTMLButtonElement, status: string): void {
  const originalLabel = button.getAttribute("aria-label") || "";
  button.setAttribute("aria-label", status);
  window.setTimeout(() => {
    button.setAttribute("aria-label", originalLabel);
  }, 1800);
}

function setNoIndex(): void {
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.append(robots);
  }
  robots.content = "noindex, nofollow";
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
