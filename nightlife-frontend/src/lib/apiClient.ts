// src/lib/apiClient.ts
// One gate for all HTTP calls: credentials, JSON parsing, CSRF header, and typed helpers.

import { getCsrfToken } from "./csrf";

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type BodyInitish = BodyInit | Record<string, unknown> | undefined;

export type ApiOptions = {
  method?: HttpMethod;
  body?: BodyInitish;
  headers?: Record<string, string>;
  csrf?: boolean; // add X-CSRF-Token automatically
  // if you need form-data later, pass a FormData in body (we will not set JSON header)
};

export async function apiFetch<T = unknown>(url: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, csrf = false } = opts;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  let finalBody: BodyInit | undefined = undefined;

  // If body is plain object (and not FormData), send JSON
  if (body instanceof FormData) {
    finalBody = body;
    // Do NOT set Content-Type; the browser will set boundary automatically
  } else if (body && typeof body === "object") {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(body);
  } else if (typeof body !== "undefined") {
    finalBody = body as BodyInit;
  }

  if (csrf && method !== "GET") {
    const token = await getCsrfToken();
    if (token) finalHeaders["X-CSRF-Token"] = token;
  }

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    credentials: "include", // send cookies for auth/sessionId
    body: ["GET", "HEAD"].includes(method) ? undefined : finalBody,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    let message = `Request failed with ${res.status}`;
    let details: unknown;
    if (isJson) {
      const data = await res.json().catch(() => ({}));
      message = (data?.message as string) || message;
      details = data;
    } else {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    const error: ApiError = { status: res.status, message, details };
    throw error;
  }

  if (isJson) {
    return (await res.json()) as T;
  }
  // If you ever fetch blobs/text, add helpers as needed
  return (await res.text()) as unknown as T;
}

// Convenience helpers
export const api = {
  get: <T>(url: string, headers?: Record<string, string>) =>
    apiFetch<T>(url, { method: "GET", headers }),

  post: <T>(url: string, body?: BodyInitish, csrf = true) =>
    apiFetch<T>(url, { method: "POST", body, csrf }),

  patch: <T>(url: string, body?: BodyInitish, csrf = true) =>
    apiFetch<T>(url, { method: "PATCH", body, csrf }),

  put: <T>(url: string, body?: BodyInitish, csrf = true) =>
    apiFetch<T>(url, { method: "PUT", body, csrf }),

  delete: <T>(url: string, csrf = true) =>
    apiFetch<T>(url, { method: "DELETE", csrf }),
};
