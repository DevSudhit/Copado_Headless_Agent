// ────────────────────────────────────────────────────────────────────────────
// Thin fetch wrapper used by all live API clients.
// Node 20+ ships fetch built-in — no extra runtime dependency needed.
// ────────────────────────────────────────────────────────────────────────────

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: string,
    readonly url: string,
  ) {
    super(`HTTP ${status} ${statusText} — ${url}`);
    this.name = "HttpError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly bearerToken: string,
    private readonly extraHeaders: Record<string, string> = {},
  ) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;
    const method = options.method ?? "GET";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${this.bearerToken}`,
      ...this.extraHeaders,
      ...(options.headers ?? {}),
    };

    const init: RequestInit = {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    };

    const response = await fetch(url, init);

    const text = await response.text();

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, text, url);
    }

    if (!text) return {} as T;

    // If we asked for JSON but received HTML, treat it as a non-JSON response error
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json") && text.trimStart().startsWith("<")) {
      throw new HttpError(response.status, "Non-JSON response (HTML received)", text.slice(0, 200), url);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      // Some endpoints return plain text on success (e.g. 204-like 200s)
      return text as unknown as T;
    }
  }

  get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: "GET", headers });
  }

  post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: "POST", body, headers });
  }
}
