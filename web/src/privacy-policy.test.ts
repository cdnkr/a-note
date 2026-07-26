import { beforeEach, expect, test } from "vitest";
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  renderPrivacyPolicy,
} from "./privacy-policy";

beforeEach(() => {
  document.head.innerHTML = '<meta name="description" content="Landing page">';
  document.body.innerHTML = '<div id="app" class="landing-page"></div>';
});

test("renders the public privacy policy and its local-data disclosures", () => {
  const root = document.querySelector<HTMLElement>("#app")!;
  renderPrivacyPolicy(root);

  expect(document.title).toBe("Privacy Policy — A-Note");
  expect(root.classList.contains("privacy-page")).toBe(true);
  expect(root.classList.contains("landing-page")).toBe(false);
  expect(root.querySelector("h1")?.textContent).toBe("Privacy Policy");
  expect(root.textContent).toContain(PRIVACY_POLICY_EFFECTIVE_DATE);
  expect(root.textContent).toContain("chrome.storage.local");
  expect(root.textContent).toContain("current website’s localStorage");
  expect(root.textContent).toContain("native share controls");
  expect(root.textContent).toContain("Chrome Web Store User Data Policy");
  expect(root.textContent).toContain("No analytics, telemetry, remote logging");
  expect(root.querySelector<HTMLAnchorElement>('.privacy-header a[href="/"]')).not.toBeNull();
  expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content)
    .toContain("webpage addresses");
});
