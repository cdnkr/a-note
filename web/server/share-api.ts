export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
export const MAX_COMMENT_LENGTH = 240;
export const MAX_XPATH_LENGTH = 4096;
export const MAX_URL_LENGTH = 8192;
export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_SCREENSHOT_BYTES + 256 * 1024;

export interface Env {
  SHARES: R2Bucket;
  APP_ORIGIN?: string;
  ALLOWED_UPLOAD_ORIGINS?: string;
}

export interface StoredShareRecord {
  version: 1;
  id: string;
  targetUrl: string;
  xpath: string;
  comment: string;
  createdAt: string;
  screenshotKey: string;
}

export interface PublicShareRecord {
  version: 1;
  id: string;
  targetUrl: string;
  xpath: string;
  comment: string;
  createdAt: string;
  screenshotUrl: string;
}

interface ScreenshotFile {
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function createShare(request: Request, env: Env): Promise<Response> {
  const origin = allowedRequestOrigin(request, env);
  if (!origin) return apiError("origin_not_allowed", "This upload origin is not allowed.", 403);

  if (request.method === "OPTIONS") return preflight(origin);
  if (request.method !== "POST") return withCors(apiError("method_not_allowed", "Method not allowed.", 405), origin);

  const client = request.headers.get("X-Annotate-Client");
  if (client !== "extension-v1" && client !== "web-v1") {
    return withCors(apiError("client_not_allowed", "This upload client is not allowed.", 403), origin);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return withCors(apiError("payload_too_large", "The screenshot is larger than 10 MiB.", 413), origin);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (_error) {
    return withCors(apiError("invalid_form", "Expected a multipart form upload.", 400), origin);
  }

  const targetUrl = textField(form, "targetUrl");
  const xpath = textField(form, "xpath");
  const comment = textField(form, "comment").trim();
  const screenshot = form.get("screenshot");
  const validationError = validateShareInput({ targetUrl, xpath, comment, screenshot });
  if (validationError) return withCors(apiError(validationError.code, validationError.message, 400), origin);

  const id = createShareId();
  const screenshotKey = screenshotKeyFor(id);
  const metadataKey = metadataKeyFor(id);
  const createdAt = new Date().toISOString();
  const record: StoredShareRecord = {
    version: 1,
    id,
    targetUrl: new URL(targetUrl).toString(),
    xpath,
    comment,
    createdAt,
    screenshotKey,
  };

  try {
    const image = screenshot as unknown as ScreenshotFile;
    await env.SHARES.put(screenshotKey, await image.arrayBuffer(), {
      httpMetadata: {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    try {
      await env.SHARES.put(metadataKey, JSON.stringify(record), {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      });
    } catch (error) {
      await env.SHARES.delete(screenshotKey).catch(() => undefined);
      throw error;
    }
  } catch (_error) {
    return withCors(apiError("storage_error", "The share could not be saved. Please try again.", 500), origin);
  }

  const appOrigin = configuredAppOrigin(request, env);
  return withCors(json({
    id,
    shareUrl: `${appOrigin}/s/${id}`,
    screenshotUrl: `${appOrigin}/api/shares/${id}/image`,
  }, 201), origin);
}

export async function getShare(request: Request, env: Env, id: string): Promise<Response> {
  if (request.method !== "GET") return apiError("method_not_allowed", "Method not allowed.", 405);
  if (!SHARE_ID_PATTERN.test(id)) return apiError("invalid_share_id", "This share link is invalid.", 400);

  let object: R2ObjectBody | null;
  try {
    object = await env.SHARES.get(metadataKeyFor(id));
  } catch (_error) {
    return apiError("storage_error", "The share service is temporarily unavailable.", 503);
  }
  if (!object) return apiError("not_found", "This shared annotation is unavailable.", 404);

  try {
    const stored = await object.json<StoredShareRecord>();
    if (stored.version !== 1 || stored.id !== id) throw new Error("Invalid metadata");
    const appOrigin = configuredAppOrigin(request, env);
    const response: PublicShareRecord = {
      version: 1,
      id: stored.id,
      targetUrl: stored.targetUrl,
      xpath: stored.xpath,
      comment: stored.comment,
      createdAt: stored.createdAt,
      screenshotUrl: `${appOrigin}/api/shares/${id}/image`,
    };
    return publicJson(response);
  } catch (_error) {
    return apiError("invalid_record", "This shared annotation is unavailable.", 502);
  }
}

export async function getScreenshot(request: Request, env: Env, id: string): Promise<Response> {
  if (request.method !== "GET") return apiError("method_not_allowed", "Method not allowed.", 405);
  if (!SHARE_ID_PATTERN.test(id)) return apiError("invalid_share_id", "This share link is invalid.", 400);

  let object: R2ObjectBody | null;
  try {
    object = await env.SHARES.get(screenshotKeyFor(id));
  } catch (_error) {
    return apiError("storage_error", "The screenshot service is temporarily unavailable.", 503);
  }
  if (!object) return apiError("not_found", "This screenshot is unavailable.", 404);

  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": "image/jpeg",
    "X-Content-Type-Options": "nosniff",
  });
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}

export function preflightForRequest(request: Request, env: Env): Response {
  const origin = allowedRequestOrigin(request, env);
  return origin
    ? preflight(origin)
    : apiError("origin_not_allowed", "This upload origin is not allowed.", 403);
}

export function createShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function metadataKeyFor(id: string): string {
  return `shares/${id}/metadata.json`;
}

export function screenshotKeyFor(id: string): string {
  return `shares/${id}/screenshot.jpg`;
}

function validateShareInput(input: {
  targetUrl: string;
  xpath: string;
  comment: string;
  screenshot: FormDataEntryValue | null;
}): { code: string; message: string } | null {
  if (!input.targetUrl || input.targetUrl.length > MAX_URL_LENGTH) {
    return { code: "invalid_target_url", message: "The target URL is invalid." };
  }
  try {
    const url = new URL(input.targetUrl);
    if (!/^https?:$/.test(url.protocol)) throw new Error("Invalid protocol");
  } catch (_error) {
    return { code: "invalid_target_url", message: "The target URL is invalid." };
  }
  if (!input.xpath || input.xpath.length > MAX_XPATH_LENGTH) {
    return { code: "invalid_xpath", message: "The annotation target is invalid." };
  }
  if (!input.comment || input.comment.length > MAX_COMMENT_LENGTH) {
    return { code: "invalid_comment", message: "The comment must contain between 1 and 240 characters." };
  }
  if (!isScreenshotFile(input.screenshot)) {
    return { code: "invalid_screenshot", message: "A JPEG screenshot is required." };
  }
  if (input.screenshot.type !== "image/jpeg" || input.screenshot.size === 0) {
    return { code: "invalid_screenshot", message: "A JPEG screenshot is required." };
  }
  if (input.screenshot.size > MAX_SCREENSHOT_BYTES) {
    return { code: "payload_too_large", message: "The screenshot is larger than 10 MiB." };
  }
  return null;
}

function isScreenshotFile(value: FormDataEntryValue | null): value is File & ScreenshotFile {
  return Boolean(
    value
    && typeof value === "object"
    && typeof value.type === "string"
    && typeof value.size === "number"
    && typeof value.arrayBuffer === "function",
  );
}

function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function configuredAppOrigin(request: Request, env: Env): string {
  try {
    const configured = env.APP_ORIGIN ? new URL(env.APP_ORIGIN) : new URL(request.url);
    if (!/^https?:$/.test(configured.protocol)) throw new Error("Invalid origin");
    return configured.origin;
  } catch (_error) {
    return new URL(request.url).origin;
  }
}

function allowedRequestOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = (env.ALLOWED_UPLOAD_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function preflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

function withCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  corsHeaders(origin).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function corsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Annotate-Client",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });
}

function publicJson(value: unknown, status = 200): Response {
  const response = json(value, status);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Cache-Control", "public, max-age=300");
  return response;
}

function apiError(code: string, message: string, status: number): Response {
  const response = json({ error: { code, message } }, status);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
