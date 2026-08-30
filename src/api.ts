import type { ApiErrorResponse, CreateFlagPayload, FeatureFlag, FlagListResponse } from "../shared/types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const data = (await response.json().catch(() => ({}))) as T & Partial<ApiErrorResponse>;
  if (!response.ok) {
    throw new Error(data.error?.message || "Request failed.");
  }
  return data;
}

export function fetchFlags(): Promise<FeatureFlag[]> {
  return request<FlagListResponse>("/api/v1/flags?limit=100").then((response) => response.data);
}

export function createFlag(payload: CreateFlagPayload): Promise<FeatureFlag> {
  return request<FeatureFlag>("/api/v1/flags", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateFlagEnabled(
  id: string,
  enabled: boolean
): Promise<FeatureFlag> {
  return request<FeatureFlag>(`/api/v1/flags/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}
