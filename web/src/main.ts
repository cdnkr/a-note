import "./styles.css";
import { CHROME_STORE_URL, EXTENSION_ID } from "./config";
import {
  fetchShareRecord,
  pingExtension,
  ShareRequestError,
  shareIdFromPath,
  targetUrlWithShare,
  type ShareRecord,
} from "./share-client";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("App root not found");

const shareRoute = location.pathname.startsWith("/s/");
if (shareRoute) {
  void renderSharePage(app);
} else {
  renderLandingPage(app);
}

function brand(): string {
  return `<a class="brand" href="/" aria-label="Annotate home"><span class="brand-mark">A</span><span>annotate</span></a>`;
}

function arrowIcon(): string {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4"/></svg>`;
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
        <p>Highlight any element, add a comment, and share the full context in one simple link.</p>
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
            <p>Send a durable link with the page, screenshot, target, and comment together.</p>
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
          <ul><li><span>✓</span> Local-first annotations</li><li><span>✓</span> Visual share fallback</li><li><span>✓</span> No account required</li></ul>
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
  document.title = "Opening shared annotation — Annotate";
  const shareId = shareIdFromPath(location.pathname);
  if (!shareId) {
    renderShareError(root, "That link doesn’t look right.", "Check the URL or ask the sender for a new share link.");
    return;
  }

  root.innerHTML = `
    <header class="share-header shell">${brand()}<a class="button button-small" href="${escapeAttribute(CHROME_STORE_URL)}">Get the extension ${arrowIcon()}</a></header>
    <main class="share-loading shell" aria-live="polite">
      <span class="loader-mark">A</span>
      <span class="loading-line"></span><span class="loading-line loading-line-short"></span>
      <p>Opening shared annotation…</p>
    </main>`;

  try {
    const [record, installed] = await Promise.all([
      fetchShareRecord(shareId),
      pingExtension(EXTENSION_ID),
    ]);
    if (installed) {
      location.replace(targetUrlWithShare(record.targetUrl, shareId));
      return;
    }
    renderShareFallback(root, record);
  } catch (error) {
    if (error instanceof ShareRequestError && error.status === 404) {
      renderShareError(root, "This share isn’t available.", "It may have been removed, or the link may be incomplete.");
      return;
    }
    renderShareError(root, "We couldn’t open this share.", "Please check your connection and try again.");
  }
}

function renderShareFallback(root: HTMLElement, record: ShareRecord): void {
  document.title = "Shared annotation — Annotate";
  const source = new URL(record.targetUrl);
  root.replaceChildren();

  const header = document.createElement("header");
  header.className = "share-header shell";
  header.innerHTML = `${brand()}<a class="button button-small" href="${escapeAttribute(CHROME_STORE_URL)}">Get the extension ${arrowIcon()}</a>`;

  const main = document.createElement("main");
  main.className = "share-view shell";
  const intro = document.createElement("div");
  intro.className = "share-intro";
  intro.innerHTML = `<h1>A note on <span></span></h1><p>Install Annotate to open this feedback directly on the original element.</p>`;
  intro.querySelector("h1 span")!.textContent = source.hostname;

  const screenshot = document.createElement("figure");
  screenshot.className = "share-screenshot";
  const image = document.createElement("img");
  image.src = record.screenshotUrl;
  image.alt = "Screenshot showing the highlighted element";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    screenshot.classList.add("is-broken");
    screenshot.replaceChildren();
    const message = document.createElement("p");
    message.textContent = "The screenshot could not be displayed.";
    screenshot.append(message);
  }, { once: true });
  screenshot.append(image);

  // const note = document.createElement("section");
  // note.className = "shared-note";
  // note.setAttribute("aria-label", "Shared comment");
  // const noteMark = document.createElement("span");
  // noteMark.className = "note-mark";
  // noteMark.textContent = "A";
  // const noteCopy = document.createElement("div");
  // const noteLabel = document.createElement("span");
  // noteLabel.className = "note-label";
  // noteLabel.textContent = "Comment";
  // const comment = document.createElement("p");
  // comment.textContent = record.comment;
  // noteCopy.append(noteLabel, comment);
  // note.append(noteMark, noteCopy);

  const actions = document.createElement("div");
  actions.className = "share-actions";
  const install = actionLink("Get the extension", CHROME_STORE_URL, "button");
  const sourceLink = actionLink(`Open ${source.hostname}`, record.targetUrl, "button button-secondary");
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  actions.append(install, sourceLink);

  main.append(
    intro,
    screenshot,
    // note,
    actions
  );
  root.append(header, main, shareFooter());
}

function renderShareError(root: HTMLElement, title: string, copy: string): void {
  setNoIndex();
  document.title = `${title} — Annotate`;
  root.innerHTML = `<header class="share-header shell">${brand()}</header>`;
  const main = document.createElement("main");
  main.className = "share-error shell";
  main.innerHTML = `<span class="error-mark">!</span>`;
  const heading = document.createElement("h1");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.textContent = copy;
  main.append(heading, paragraph, actionLink("Back to Annotate", "/", "button"));
  root.append(main, shareFooter());
}

function shareFooter(): HTMLElement {
  const footer = document.createElement("footer");
  footer.className = "share-footer shell";
  footer.textContent = "Shared with Annotate";
  return footer;
}

function actionLink(label: string, href: string, className: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
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
