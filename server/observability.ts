import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

type Level = "info" | "warn" | "error";

export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...fields });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

let requestCount = 0;
let errorCount = 0;
let durationTotalMs = 0;

export function requestTelemetry(req: Request, res: Response, next: NextFunction): void {
  const started = performance.now();
  req.requestId = req.header("x-request-id")?.slice(0, 128) || randomUUID();
  res.setHeader("x-request-id", req.requestId);
  requestCount += 1;

  res.on("finish", () => {
    const durationMs = Math.round((performance.now() - started) * 100) / 100;
    durationTotalMs += durationMs;
    if (res.statusCode >= 500) errorCount += 1;
    log("info", "request_completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      durationMs,
    });
  });
  next();
}

export function metrics(): string {
  return [
    "# HELP http_requests_total Total HTTP requests.",
    "# TYPE http_requests_total counter",
    `http_requests_total ${requestCount}`,
    "# HELP http_server_errors_total Total HTTP 5xx responses.",
    "# TYPE http_server_errors_total counter",
    `http_server_errors_total ${errorCount}`,
    "# HELP http_request_duration_milliseconds_total Cumulative request duration.",
    "# TYPE http_request_duration_milliseconds_total counter",
    `http_request_duration_milliseconds_total ${durationTotalMs.toFixed(2)}`,
    "",
  ].join("\n");
}
