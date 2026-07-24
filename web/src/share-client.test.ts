import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchShareRecord,
  ShareRequestError,
  shareIdFromPath,
  type ShareRecord,
} from "./share-client";

const SHARE_ID = "AbCdEfGhIjKlMnOpQrStUv";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("share routes", () => {
  it("reads only well-formed share paths", () => {
    expect(shareIdFromPath(`/s/${SHARE_ID}`)).toBe(SHARE_ID);
    expect(shareIdFromPath(`/s/${SHARE_ID}/`)).toBe(SHARE_ID);
    expect(shareIdFromPath("/s/short")).toBeNull();
    expect(shareIdFromPath(`/other/${SHARE_ID}`)).toBeNull();
  });
});

describe("share API client", () => {
  it("returns a share record", async () => {
    const record: ShareRecord = {
      version: 2,
      id: SHARE_ID,
      targetUrl: "https://example.com",
      createdAt: "2026-07-15T00:00:00.000Z",
      screenshotUrl: `https://annotate.example/api/shares/${SHARE_ID}/image`,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(record)));
    await expect(fetchShareRecord(SHARE_ID)).resolves.toEqual(record);
  });

  it("maps unavailable shares to a typed error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
      { error: { message: "This shared screenshot is unavailable." } },
      { status: 404 },
    )));
    await expect(fetchShareRecord(SHARE_ID)).rejects.toMatchObject({ status: 404 } satisfies Partial<ShareRequestError>);
  });
});
