import { arrowIcon, brand } from "./brand";
import { CHROME_STORE_URL } from "./config";
import { escapeAttribute } from "./utils";

export const PRIVACY_POLICY_PATH = "/privacy-policy";
export const PRIVACY_POLICY_EFFECTIVE_DATE = "July 26, 2026";

export function renderPrivacyPolicy(root: HTMLElement): void {
  document.title = "Privacy Policy — A-Note";
  updateDescription(
    "How A-Note handles webpage addresses, annotations, interactions, and screenshots.",
  );
  root.classList.remove("landing-page");
  root.classList.add("privacy-page");
  root.innerHTML = `
    <header class="site-header shell">
      ${brand()}
      <a class="button button-small" href="${escapeAttribute(CHROME_STORE_URL)}">Get the extension ${arrowIcon()}</a>
    </header>

    <main class="privacy-main shell">
      <article class="privacy-policy">
        <header class="privacy-title">
          <h1>Privacy Policy</h1>
          <p>Effective ${PRIVACY_POLICY_EFFECTIVE_DATE}</p>
        </header>

        <div class="privacy-summary">
          <p><strong>The short version:&nbsp;</strong>A-Note is local-first. It has no user accounts, advertising, analytics, or developer-operated backend. Information needed to create and restore annotations stays in your browser unless you deliberately share an annotated screenshot.</p>
        </div>

        <section>
          <h2>About A-Note</h2>
          <p>A-Note is a Chrome extension that lets you attach short notes and highlights to webpage elements or selected text, then capture, download, or share an annotated screenshot. This policy describes how the extension and the A-Note website handle information.</p>
        </section>

        <section>
          <h2>Information the extension handles</h2>
          <p>A-Note handles only the information needed to provide its annotation features:</p>
          <ul>
            <li><strong>Webpage addresses.</strong> The exact URL of a page you annotate is used as the local key that lets A-Note restore that page’s annotations.</li>
            <li><strong>Annotation and website content.</strong> A saved annotation may include the note text you enter, an element locator or selected text range and nearby quote context, an identifier, and its creation time.</li>
            <li><strong>Feature interactions.</strong> While annotation mode is active, A-Note processes clicks, pointer positions, dragging, text selection, scrolling, and note input as needed to select targets and position the interface. It does not create a general browsing or keystroke log.</li>
            <li><strong>Screenshot content.</strong> When you choose a capture action, A-Note processes the visible part of the active tab, including visible annotations, to create an in-memory JPEG preview.</li>
            <li><strong>Preferences and layout.</strong> A-Note stores your selected annotation colour. If you manually move a note, it also stores that note’s coordinates and the viewport width so the layout can be restored.</li>
          </ul>
        </section>

        <section>
          <h2>How information is stored</h2>
          <ul>
            <li>Annotations, their page URLs, and the selected colour are stored on your device using <code>chrome.storage.local</code>.</li>
            <li>Manually adjusted note positions are stored in the current website’s <code>localStorage</code>. This storage belongs to that website’s origin and may be accessible to scripts operated by that website.</li>
            <li>Screenshots are kept in browser memory for the lifetime of the preview. A-Note does not upload or retain a copy on a server.</li>
          </ul>
          <p>A-Note does not provide cloud synchronisation and does not transmit this information to the A-Note developer.</p>
        </section>

        <section>
          <h2>Sharing and downloads</h2>
          <p>A-Note shares nothing automatically. If you choose Share, the screenshot file is passed to your browser or operating system’s native share controls, and you choose the destination. If you choose Download, the file is saved to your device. Any destination you select has its own privacy practices; A-Note does not receive a copy of the shared file.</p>
        </section>

        <section>
          <h2>What A-Note does not do</h2>
          <ul>
            <li>No accounts, registration, or authentication.</li>
            <li>No advertising, profiling, or sale of personal information.</li>
            <li>No analytics, telemetry, remote logging, or background browsing collection.</li>
            <li>No developer access to your annotations, page content, browsing activity, or screenshots.</li>
          </ul>
        </section>

        <section>
          <h2>Extension permissions</h2>
          <p>A-Note uses Chrome’s <code>storage</code> permission for local annotations and preferences. It uses <code>activeTab</code> and <code>scripting</code> only after you click the extension action, allowing its packaged annotation interface to run temporarily on the page you selected. A-Note does not request persistent host access.</p>
        </section>

        <section>
          <h2>The A-Note website</h2>
          <p>The public A-Note website is static and does not use accounts, forms, cookies, or analytics. Like any website, its hosting provider may process basic request information such as an IP address, browser type, and request time to deliver and secure the site. A-Note does not use that information to track or profile visitors.</p>
        </section>

        <section>
          <h2>Your choices and retention</h2>
          <p>You can delete individual annotations using A-Note’s Delete control and close a screenshot preview to release its in-memory copy. You can remove extension-managed local data by uninstalling A-Note. Manually adjusted note-position data follows the storage controls for the relevant website and can be removed by clearing that website’s site data in Chrome.</p>
        </section>

        <section>
          <h2>Chrome Web Store Limited Use</h2>
          <p>A-Note’s use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Information is used only to provide or improve A-Note’s single, user-facing purpose. It is not used for advertising, creditworthiness, lending, or purposes unrelated to webpage annotation and screenshot sharing.</p>
        </section>

        <section>
          <h2>Changes to this policy</h2>
          <p>If A-Note’s data practices change, this page will be updated and the effective date above will be revised. Material changes will be reflected in the Chrome Web Store disclosures before an updated extension is published.</p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>For privacy questions, contact the developer using the support contact information published with A-Note’s Chrome Web Store listing.</p>
        </section>
      </article>
    </main>

    <footer class="site-footer shell">
      <span>© ${new Date().getFullYear()} A-Note</span>
    </footer>
  `;
}

function updateDescription(content: string): void {
  let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!description) {
    description = document.createElement("meta");
    description.name = "description";
    document.head.append(description);
  }
  description.content = content;
}
