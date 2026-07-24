import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchShareRecord,
  pingExtension,
  ShareRequestError,
  shareIdFromPath,
  targetUrlWithShare,
  type ChromeRuntimeLike,
  type ShareRecord,
} from "./share-client";

const SHARE_ID = "AbCdEfGhIjKlMnOpQrStUv";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("share routes", () => {
  it("reads only well-formed share paths", () => {
    expect(shareIdFromPath(`/s/${SHARE_ID}`)).toBe(SHARE_ID);
    expect(shareIdFromPath(`/s/${SHARE_ID}/`)).toBe(SHARE_ID);
    expect(shareIdFromPath("/s/short")).toBeNull();
    expect(shareIdFromPath(`/other/${SHARE_ID}`)).toBeNull();
  });

  it("adds the share ID while preserving query parameters and the hash", () => {
    const result = new URL(targetUrlWithShare("https://example.com/page?x=real&c=value#hero", SHARE_ID));
    expect(result.searchParams.get("x")).toBe("real");
    expect(result.searchParams.get("c")).toBe("value");
    expect(result.searchParams.get("annotateShare")).toBe(SHARE_ID);
    expect(result.hash).toBe("#hero");
  });
});

describe("extension detection", () => {
  it("resolves true for a successful extension ping", async () => {
    const runtime: ChromeRuntimeLike = {
      sendMessage: (_id, _message, callback) => callback({ ok: true, installed: true }),
    };
    await expect(pingExtension("extension-id", 1500, runtime)).resolves.toBe(true);
  });

  it("falls back after the detection timeout", async () => {
    vi.useFakeTimers();
    const runtime: ChromeRuntimeLike = { sendMessage: () => undefined };
    const result = pingExtension("extension-id", 1500, runtime);
    await vi.advanceTimersByTimeAsync(1500);
    await expect(result).resolves.toBe(false);
  });

  it("falls back immediately when no extension ID is configured", async () => {
    await expect(pingExtension("", 1500, undefined)).resolves.toBe(false);
  });
});

describe("share API client", () => {
  it("returns a share record", async () => {
    const record: ShareRecord = {
      version: 1,
      id: SHARE_ID,
      targetUrl: "https://example.com",
      xpath: "/html[1]/body[1]",
      comment: "Clear and specific.",
      createdAt: "2026-07-15T00:00:00.000Z",
      screenshotUrl: `https://annotate.example/api/shares/${SHARE_ID}/image`,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(record)));
    await expect(fetchShareRecord(SHARE_ID)).resolves.toEqual(record);
  });

  it("maps unavailable shares to a typed error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
      { error: { message: "This shared annotation is unavailable." } },
      { status: 404 },
    )));
    await expect(fetchShareRecord(SHARE_ID)).rejects.toMatchObject({ status: 404 } satisfies Partial<ShareRequestError>);
  });
});
