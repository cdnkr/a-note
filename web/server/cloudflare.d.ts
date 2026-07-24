interface R2HTTPMetadata {
  contentType?: string;
  cacheControl?: string;
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
}

interface R2Object {
  key: string;
  httpEtag: string;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
  blob(): Promise<Blob>;
  json<T>(): Promise<T>;
  text(): Promise<string>;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: R2PutOptions): Promise<R2Object | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

interface PagesFunctionContext<Env> {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}

type PagesFunction<Env = unknown> = (context: PagesFunctionContext<Env>) => Response | Promise<Response>;
