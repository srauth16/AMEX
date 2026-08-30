import type { CreateFlagPayload } from "../shared/types.js";
import { HttpError } from "./httpError.js";

const KEY_PATTERN = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/;

function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError("Request body must be a JSON object.", 400, "INVALID_BODY");
  }
  return value as Record<string, unknown>;
}

function rejectUnknown(record: Record<string, unknown>, allowed: string[]): void {
  const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw new HttpError(`Unknown field: ${unknown[0]}.`, 400, "UNKNOWN_FIELD");
  }
}

function text(record: Record<string, unknown>, field: string, max: number, required = false): string {
  const value = record[field];
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || (required && !value.trim())) {
    throw new HttpError(`${field} must be a non-empty string.`, 400, "VALIDATION_FAILED", { [field]: "Invalid value" });
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new HttpError(`${field} must be at most ${max} characters.`, 400, "VALIDATION_FAILED", { [field]: "Too long" });
  }
  return trimmed;
}

export function parseCreateFlag(value: unknown): CreateFlagPayload {
  const record = objectBody(value);
  rejectUnknown(record, ["name", "key", "description", "enabled"]);
  const name = text(record, "name", 120, true);
  const key = text(record, "key", 80, true).toLowerCase();
  const description = text(record, "description", 500);
  if (!KEY_PATTERN.test(key)) {
    throw new HttpError("key has an invalid format.", 400, "VALIDATION_FAILED", { key: "Use lowercase letters, numbers, hyphens, or underscores" });
  }
  if (typeof record.enabled !== "boolean") {
    throw new HttpError("enabled must be true or false.", 400, "VALIDATION_FAILED", { enabled: "Expected boolean" });
  }
  return { name, key, description, enabled: record.enabled };
}

export function parseEnabled(value: unknown): boolean {
  const record = objectBody(value);
  rejectUnknown(record, ["enabled"]);
  if (typeof record.enabled !== "boolean") {
    throw new HttpError("enabled must be true or false.", 400, "VALIDATION_FAILED", { enabled: "Expected boolean" });
  }
  return record.enabled;
}

export function parseListQuery(query: Record<string, unknown>): { q: string; limit: number; offset: number } {
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 200) : "";
  const parse = (name: "limit" | "offset", fallback: number, max: number) => {
    const raw = query[name];
    if (raw === undefined) return fallback;
    if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
      throw new HttpError(`${name} must be a non-negative integer.`, 400, "INVALID_QUERY");
    }
    return Math.min(Number(raw), max);
  };
  return { q, limit: parse("limit", 50, 100), offset: parse("offset", 0, 1_000_000) };
}
