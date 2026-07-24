import "./styles.css";
import { CHROME_STORE_URL } from "./config";
import {
  fetchShareRecord,
  ShareRequestError,
  shareColorFromSearch,
  shareIdFromPath,
  type ShareRecord,
} from "./share-client";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("App root not found");

const shareRoute = location.pathname.startsWith("/s/");
if (shareRoute) {
  applyShareColor(location.search);
  void renderSharePage(app);
} else {
  renderLandingPage(app);
}

function applyShareColor(search: string): void {
  const color = shareColorFromSearch(search);
  document.documentElement.style.setProperty("--blue", color.value);
  document.documentElement.style.setProperty("--blue-dark", color.darkValue);
  document.documentElement.style.setProperty("--primary-rgb", color.rgb);
  document.documentElement.style.setProperty("--primary-foreground", color.foreground);
}

function brand(): string {
  return `<a class="brand" href="/" aria-label="Annotate home"><span class="brand-mark">A</span><span>annotate</span></a>`;
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
  document.title = "Annotate — Feedback, in context";
  root.innerHTML = `
    <header class="site-header shell">
      ${brand()}
      <nav aria-label="Main navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#features">Features</a>
      </nav>
      <a class="button button-small" href="${escapeAttribute(CHROME_STORE_URL)}">Get the extension ${arrowIcon()}</a>
    </header>

    <main>
      <section class="hero shell">
        <span class="eyebrow"><i></i> Feedback, in context</span>
        <h1>Leave feedback exactly<br>where it belongs.</h1>
        <p>Highlight any element, add a comment, and share the visual context in one simple link.</p>
        <div class="hero-actions">
          <a class="button" href="${escapeAttribute(CHROME_STORE_URL)}">Get the extension ${arrowIcon()}</a>
          <a class="text-link" href="#how-it-works">See how it works <span>↓</span></a>
        </div>
      </section>

      <section class="product-stage shell" aria-label="Annotate product preview">
        <div class="browser-frame">
          <div class="browser-bar"><span></span><span></span><span></span><div class="browser-address">yourwebsite.com/pricing</div></div>
          <div class="demo-page">
            <div class="demo-nav"><b>northstar</b><span>Product&nbsp;&nbsp;&nbsp; Pricing&nbsp;&nbsp;&nbsp; About</span><i></i></div>
            <div class="demo-copy">
              <span class="demo-label">Made for growing teams</span>
              <h2>Move ideas forward,<br>together.</h2>
              <p>A calmer way to collect thoughtful feedback.</p>
              <button type="button" tabindex="-1">Start a project</button>
            </div>
            <div class="demo-art" aria-hidden="true"><i></i><i></i><i></i></div>
            <div class="demo-highlight" aria-hidden="true"></div>
            <div class="demo-comment"><span>1</span><p>This is the message we should lead with.</p></div>
            <div class="demo-dock"><b>A</b><i></i></div>
          </div>
        </div>
        <div class="stage-note"><span>01</span> Feedback stays attached to the work—not lost in another thread.</div>
      </section>

      <section class="steps shell" id="how-it-works">
        <div class="section-heading">
          <span class="eyebrow"><i></i> How it works</span>
          <h2>From observation to<br>shared understanding.</h2>
          <p>Annotate keeps feedback visual, specific, and immediately useful.</p>
        </div>
        <div class="step-grid" id="features">
          <article class="feature-card feature-blue">
            <span class="feature-number">01</span>
            <div class="mini-highlight"><i></i><b></b></div>
            <h3>Highlight anything</h3>
            <p>Choose the exact heading, button, image, or component you want to discuss.</p>
          </article>
          <article class="feature-card feature-pink">
            <span class="feature-number">02</span>
            <div class="mini-comment"><b>2</b><span>Make this feel a little warmer.</span></div>
            <h3>Comment in context</h3>
            <p>Leave a concise note beside the element so the meaning stays clear.</p>
          </article>
          <article class="feature-card feature-cream">
            <span class="feature-number">03</span>
            <div class="mini-link"><i></i><i></i><span>annotate.example/s/...</span></div>
            <h3>Share one link</h3>
            <p>Send a durable screenshot link that keeps the visual context intact.</p>
          </article>
        </div>
      </section>

      <section class="dark-section shell">
        <div>
          <span class="eyebrow eyebrow-dark"><i></i> Built for clarity</span>
          <h2>Less explaining.<br>More improving.</h2>
        </div>
        <div class="dark-copy">
          <p>Make reviews faster without introducing another heavy collaboration system.</p>
          <ul><li><span>✓</span> Local-first annotations</li><li><span>✓</span> Screenshot sharing</li><li><span>✓</span> No account required</li></ul>
        </div>
        <div class="dark-demo">
          <div class="dark-browser"><span>annotate</span><i></i><i></i><i></i></div>
          <div class="dark-panel"><b>A</b><div><strong>Homepage review</strong><small>3 annotations</small></div></div>
          <div class="dark-note"><span>3</span><p>The hierarchy is much clearer now.</p></div>
        </div>
      </section>

      <section class="final-cta shell">
        <span class="eyebrow"><i></i> Ready when you are</span>
        <h2>Put feedback<br>in its place.</h2>
        <p>Highlight, comment, and share without breaking your flow.</p>
        <a class="button" href="${escapeAttribute(CHROME_STORE_URL)}">Get the extension ${arrowIcon()}</a>
      </section>
    </main>

    <footer class="site-footer shell">
      ${brand()}
      <p>Feedback, exactly where it belongs.</p>
      <span>© ${new Date().getFullYear()} Annotate</span>
    </footer>
  `;
}

async function renderSharePage(root: HTMLElement): Promise<void> {
  setNoIndex();
  document.title = "Opening shared screenshot — Annotate";
  const shareId = shareIdFromPath(location.pathname);
  if (!shareId) {
    renderShareError(root, "That link doesn’t look right.", "Check the URL or ask the sender for a new share link.");
    return;
  }

  root.innerHTML = `
    <main class="share-loading shell" aria-live="polite">
      <span class="loader-mark">A</span>
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
  document.title = "Shared screenshot — Annotate";
  const source = new URL(record.targetUrl);
  root.replaceChildren();

  const main = document.createElement("main");
  main.className = "share-view";

  const screenshot = document.createElement("figure");
  screenshot.className = "share-screenshot";
  const image = document.createElement("img");
  image.src = record.screenshotUrl;
  image.alt = "Shared annotated screenshot";
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
    <span class="share-title-mark" aria-hidden="true"><span>A</span></span>
    <span>annotate</span>
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
  document.title = `${title} — Annotate`;
  root.replaceChildren();
  const main = document.createElement("main");
  main.className = "share-error shell";
  main.innerHTML = `<span class="error-mark">!</span>`;
  const heading = document.createElement("h1");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = copy;
  main.append(heading, paragraph, actionLink("Back to Annotate", "/", "button"));
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
  button.title = label;
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
  link.title = label;
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
    text: "Shared with Annotate",
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
    link.download = `annotate-${hostname.replace(/[^a-z0-9]+/gi, "-") || "screenshot"}.jpg`;
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
  button.title = status;
  window.setTimeout(() => {
    button.setAttribute("aria-label", originalLabel);
    button.title = originalLabel;
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
