// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  createShare,
  getScreenshot,
  getShare,
  MAX_SCREENSHOT_BYTES,
  type Env,
} from "./share-api";

const ALLOWED_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

class MemoryR2 {
  readonly entries = new Map<string, { bytes: Uint8Array; contentType?: string; cacheControl?: string }>();
  failMetadataWrite = false;

  async put(key: string, value: string | ArrayBuffer, options?: R2PutOptions): Promise<R2Object> {
    if (this.failMetadataWrite && key.endsWith("metadata.json")) throw new Error("metadata write failed");
    const bytes = typeof value === "string"
      ? new TextEncoder().encode(value)
      : new Uint8Array(value);
    this.entries.set(key, {
      bytes,
      contentType: options?.httpMetadata && "contentType" in options.httpMetadata
        ? options.httpMetadata.contentType
        : undefined,
      cacheControl: options?.httpMetadata && "cacheControl" in options.httpMetadata
        ? options.httpMetadata.cacheControl
        : undefined,
    });
    return { key } as R2Object;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    const arrayBuffer = entry.bytes.buffer.slice(
      entry.bytes.byteOffset,
      entry.bytes.byteOffset + entry.bytes.byteLength,
    ) as ArrayBuffer;
    const body = new Blob([arrayBuffer]).stream();
    return {
      key,
      body,
      httpEtag: '"test-etag"',
      json: async <T>() => JSON.parse(new TextDecoder().decode(entry.bytes)) as T,
      text: async () => new TextDecoder().decode(entry.bytes),
      arrayBuffer: async () => entry.bytes.buffer.slice(
        entry.bytes.byteOffset,
        entry.bytes.byteOffset + entry.bytes.byteLength,
      ),
      blob: async () => new Blob([arrayBuffer], { type: entry.contentType }),
      writeHttpMetadata: (headers: Headers) => {
        if (entry.contentType) headers.set("Content-Type", entry.contentType);
        if (entry.cacheControl) headers.set("Cache-Control", entry.cacheControl);
      },
    } as unknown as R2ObjectBody;
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

function env(bucket = new MemoryR2()): Env & { SHARES: R2Bucket } {
  return {
    SHARES: bucket as unknown as R2Bucket,
    APP_ORIGIN: "https://a-note.example",
    ALLOWED_UPLOAD_ORIGINS: `${ALLOWED_ORIGIN},http://localhost:5173`,
  };
}

function uploadRequest(overrides: {
  origin?: string | null;
  targetUrl?: string;
  screenshot?: File;
  client?: string;
  includeLegacyFields?: boolean;
} = {}): Request {
  const form = new FormData();
  form.set("targetUrl", overrides.targetUrl ?? "https://example.com/page?x=real#hero");
  if (overrides.includeLegacyFields) {
    form.set("xpath", "/html[1]/body[1]/main[1]");
    form.set("comment", "This heading needs more energy.");
  }
  form.set("screenshot", overrides.screenshot ?? new File(["jpeg-bytes"], "annotation.jpg", { type: "image/jpeg" }));
  const headers = new Headers({ "X-a-Client": overrides.client ?? "extension-v1" });
  if (overrides.origin !== null) headers.set("Origin", overrides.origin ?? ALLOWED_ORIGIN);
  return new Request("https://a-note.example/api/shares", { method: "POST", headers, body: form });
}

describe("createShare", () => {
  it("stores an immutable screenshot and version 2 metadata record", async () => {
    const bucket = new MemoryR2();
    const response = await createShare(uploadRequest(), env(bucket));
    expect(response.status).toBe(201);
    const payload = await response.json() as { id: string; shareUrl: string; screenshotUrl: string };
    expect(payload.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(payload.shareUrl).toBe(`https://a-note.example/s/${payload.id}`);
    expect(payload.screenshotUrl).toBe(`https://a-note.example/api/shares/${payload.id}/image`);
    expect([...bucket.entries.keys()].sort()).toEqual([
      `shares/${payload.id}/metadata.json`,
      `shares/${payload.id}/screenshot.jpg`,
    ]);
    const stored = JSON.parse(new TextDecoder().decode(
      bucket.entries.get(`shares/${payload.id}/metadata.json`)!.bytes,
    )) as { version: number; targetUrl: string; xpath?: string; comment?: string };
    expect(stored).toMatchObject({ version: 2, targetUrl: "https://example.com/page?x=real#hero" });
    expect(stored).not.toHaveProperty("xpath");
    expect(stored).not.toHaveProperty("comment");
  });

  it("rejects missing and disallowed origins", async () => {
    expect((await createShare(uploadRequest({ origin: null }), env())).status).toBe(403);
    expect((await createShare(uploadRequest({ origin: "https://attacker.example" }), env())).status).toBe(403);
  });

  it("rejects malformed fields and screenshot types", async () => {
    expect((await createShare(uploadRequest({ targetUrl: "javascript:alert(1)" }), env())).status).toBe(400);
    expect((await createShare(uploadRequest({
      screenshot: new File(["png"], "annotation.png", { type: "image/png" }),
    }), env())).status).toBe(400);
  });

  it("accepts and ignores fields sent by legacy extension clients", async () => {
    const response = await createShare(uploadRequest({ includeLegacyFields: true }), env());
    expect(response.status).toBe(201);
  });

  it("rejects screenshots larger than 10 MiB", async () => {
    const screenshot = new File([new Uint8Array(MAX_SCREENSHOT_BYTES + 1)], "large.jpg", { type: "image/jpeg" });
    expect((await createShare(uploadRequest({ screenshot }), env())).status).toBe(400);
  });

  it("removes the screenshot if metadata storage fails", async () => {
    const bucket = new MemoryR2();
    bucket.failMetadataWrite = true;
    const response = await createShare(uploadRequest(), env(bucket));
    expect(response.status).toBe(500);
    expect(bucket.entries.size).toBe(0);
  });
});

describe("share reads", () => {
  it("returns version 2 metadata and its private image through public endpoints", async () => {
    const bucket = new MemoryR2();
    const runtimeEnv = env(bucket);
    const created = await createShare(uploadRequest(), runtimeEnv);
    const { id } = await created.json() as { id: string };

    const metadata = await getShare(new Request(`https://a-note.example/api/shares/${id}`), runtimeEnv, id);
    expect(metadata.status).toBe(200);
    await expect(metadata.json()).resolves.toMatchObject({
      version: 2,
      id,
      targetUrl: "https://example.com/page?x=real#hero",
    });

    const image = await getScreenshot(new Request(`https://a-note.example/api/shares/${id}/image`), runtimeEnv, id);
    expect(image.status).toBe(200);
    expect(image.headers.get("Content-Type")).toBe("image/jpeg");
    expect(image.headers.get("Cache-Control")).toContain("immutable");
  });

  it("continues to read version 1 annotation records", async () => {
    const bucket = new MemoryR2();
    const runtimeEnv = env(bucket);
    const id = "AbCdEfGhIjKlMnOpQrStUv";
    await bucket.put(`shares/${id}/screenshot.jpg`, new TextEncoder().encode("jpeg").buffer, {
      httpMetadata: { contentType: "image/jpeg" },
    });
    await bucket.put(`shares/${id}/metadata.json`, JSON.stringify({
      version: 1,
      id,
      targetUrl: "https://example.com/legacy",
      xpath: "/html[1]/body[1]/main[1]",
      comment: "Legacy note",
      createdAt: "2026-07-15T00:00:00.000Z",
      screenshotKey: `shares/${id}/screenshot.jpg`,
    }));

    const response = await getShare(new Request(`https://a-note.example/api/shares/${id}`), runtimeEnv, id);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      version: 1,
      id,
      comment: "Legacy note",
      xpath: "/html[1]/body[1]/main[1]",
    });
  });

  it("returns deliberate errors for invalid and missing records", async () => {
    const runtimeEnv = env();
    expect((await getShare(new Request("https://a-note.example/api/shares/invalid"), runtimeEnv, "invalid")).status).toBe(400);
    expect((await getShare(
      new Request("https://a-note.example/api/shares/AbCdEfGhIjKlMnOpQrStUv"),
      runtimeEnv,
      "AbCdEfGhIjKlMnOpQrStUv",
    )).status).toBe(404);
  });
});
