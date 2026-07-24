export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

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
