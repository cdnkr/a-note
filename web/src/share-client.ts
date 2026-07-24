export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export interface ShareRecord {
  version: 1;
  id: string;
  targetUrl: string;
  xpath: string;
  comment: string;
  createdAt: string;
  screenshotUrl: string;
}

interface ExtensionPingResponse {
  ok?: boolean;
  installed?: boolean;
}

export interface ChromeRuntimeLike {
  lastError?: unknown;
  sendMessage(
    extensionId: string,
    message: { type: "ANNOTATE_PING" },
    callback: (response?: ExtensionPingResponse) => void,
  ): void;
}

declare global {
  interface Window {
    chrome?: { runtime?: ChromeRuntimeLike };
  }
}

export class ShareRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function shareIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/s\/([^/]+)\/?$/);
  return match && SHARE_ID_PATTERN.test(match[1]) ? match[1] : null;
}

export function targetUrlWithShare(targetUrl: string, shareId: string): string {
  if (!SHARE_ID_PATTERN.test(shareId)) throw new TypeError("Invalid share ID");
  const url = new URL(targetUrl);
  if (!/^https?:$/.test(url.protocol)) throw new TypeError("Invalid target URL");
  url.searchParams.set("annotateShare", shareId);
  return url.toString();
}

export async function fetchShareRecord(shareId: string): Promise<ShareRecord> {
  if (!SHARE_ID_PATTERN.test(shareId)) throw new ShareRequestError("This share link is invalid.", 400);
  const response = await fetch(`/api/shares/${encodeURIComponent(shareId)}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null) as ShareRecord | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = payload && "error" in payload ? payload.error?.message : undefined;
    throw new ShareRequestError(message || "This shared annotation is unavailable.", response.status);
  }
  return payload as ShareRecord;
}

export function pingExtension(
  extensionId: string,
  timeoutMs = 1500,
  runtime: ChromeRuntimeLike | undefined = window.chrome?.runtime,
): Promise<boolean> {
  if (!extensionId || !runtime?.sendMessage) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (installed: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(installed);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);

    try {
      runtime.sendMessage(extensionId, { type: "ANNOTATE_PING" }, (response) => {
        void runtime.lastError;
        finish(Boolean(response?.ok && response.installed));
      });
    } catch (_error) {
      finish(false);
    }
  });
}
