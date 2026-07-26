import "./styles.css";
import { CHROME_STORE_URL } from "./config";
import { mountLandingDemo } from "./landing-demo";
import {
  arrowIcon,
  brand,
  brandIconMarkup,
  updateBrandFavicon,
} from "./brand";
import {
  PRIVACY_POLICY_PATH,
  renderPrivacyPolicy,
} from "./privacy-policy";
import { escapeAttribute, setNoIndex } from "./utils";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("App root not found");

updateBrandFavicon();
const pathname = location.pathname.replace(/\/+$/, "") || "/";
if (pathname === PRIVACY_POLICY_PATH) {
  renderPrivacyPolicy(app);
} else if (location.pathname.startsWith("/s/")) {
  renderRetiredSharePage(app);
} else {
  renderLandingPage(app);
}

function renderLandingPage(root: HTMLElement): void {
  document.title = "A-Note — Add notes in place, on web pages.";
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

function renderRetiredSharePage(root: HTMLElement): void {
  root.classList.remove("landing-page");
  setNoIndex();
  document.title = "Screenshot links retired — A-Note";
  root.innerHTML = `
    <main class="retired-share shell">
      ${brandIconMarkup("retired-share-mark")}
      <h1>Screenshot links have been retired.</h1>
      <p>A-Note now keeps captures on your device and shares them only through your browser’s native share controls.</p>
      <a class="button" href="/">Back to A-Note</a>
    </main>
  `;
}
