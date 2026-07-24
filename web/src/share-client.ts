export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
export const DEFAULT_SHARE_COLOR_TOKEN = "cobalt";

export interface ShareColor {
  token: string;
  value: string;
  darkValue: string;
  rgb: string;
  foreground: string;
}

const SHARE_COLORS: Readonly<Record<string, ShareColor>> = Object.freeze({
  cobalt: { token: "cobalt", value: "#405cf5", darkValue: "#2945e8", rgb: "64, 92, 245", foreground: "#ffffff" },
  indigo: { token: "indigo", value: "#4f46e5", darkValue: "#4338ca", rgb: "79, 70, 229", foreground: "#ffffff" },
  violet: { token: "violet", value: "#7c3aed", darkValue: "#6d28d9", rgb: "124, 58, 237", foreground: "#ffffff" },
  purple: { token: "purple", value: "#9333ea", darkValue: "#7e22ce", rgb: "147, 51, 234", foreground: "#ffffff" },
  pink: { token: "pink", value: "#db2777", darkValue: "#be185d", rgb: "219, 39, 119", foreground: "#ffffff" },
  red: { token: "red", value: "#dc2626", darkValue: "#b91c1c", rgb: "220, 38, 38", foreground: "#ffffff" },
  orange: { token: "orange", value: "#f97316", darkValue: "#ea580c", rgb: "249, 115, 22", foreground: "#111a2e" },
  yellow: { token: "yellow", value: "#facc15", darkValue: "#eab308", rgb: "250, 204, 21", foreground: "#111a2e" },
  lime: { token: "lime", value: "#84cc16", darkValue: "#65a30d", rgb: "132, 204, 22", foreground: "#111a2e" },
  green: { token: "green", value: "#059669", darkValue: "#047857", rgb: "5, 150, 105", foreground: "#ffffff" },
  teal: { token: "teal", value: "#0d9488", darkValue: "#0f766e", rgb: "13, 148, 136", foreground: "#ffffff" },
  slate: { token: "slate", value: "#344054", darkValue: "#1d2939", rgb: "52, 64, 84", foreground: "#ffffff" },
});

export interface ShareRecordBase {
  id: string;
  targetUrl: string;
  createdAt: string;
  screenshotUrl: string;
}

export interface ShareRecordV1 extends ShareRecordBase {
  version: 1;
  xpath: string;
  comment: string;
}

export interface ShareRecordV2 extends ShareRecordBase {
  version: 2;
}

export type ShareRecord = ShareRecordV1 | ShareRecordV2;

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

export function shareColorFromSearch(search: string): ShareColor {
  const token = new URLSearchParams(search).get("c") || DEFAULT_SHARE_COLOR_TOKEN;
  return Object.hasOwn(SHARE_COLORS, token)
    ? SHARE_COLORS[token]
    : SHARE_COLORS[DEFAULT_SHARE_COLOR_TOKEN];
}

export async function fetchShareRecord(shareId: string): Promise<ShareRecord> {
  if (!SHARE_ID_PATTERN.test(shareId)) throw new ShareRequestError("This share link is invalid.", 400);
  const response = await fetch(`/api/shares/${encodeURIComponent(shareId)}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null) as ShareRecord | { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = payload && "error" in payload ? payload.error?.message : undefined;
    throw new ShareRequestError(message || "This shared screenshot is unavailable.", response.status);
  }
  return payload as ShareRecord;
}
