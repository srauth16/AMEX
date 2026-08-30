import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { HttpError } from "./httpError.js";
import { log, metrics, requestTelemetry } from "./observability.js";
import { openApiDocument } from "./openapi.js";
import { createFlag, listFlags, setFlagEnabled } from "./store.js";
import { parseCreateFlag, parseEnabled, parseListQuery } from "./validation.js";

const config = loadConfig();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

let ready = false;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

app.use(requestTelemetry);
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes("*") || config.allowedOrigins.includes(origin)) callback(null, true);
    else callback(new HttpError("Origin is not allowed.", 403, "ORIGIN_NOT_ALLOWED"));
  },
}));
app.use(express.json({ limit: config.jsonLimit, strict: true }));

app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
app.get("/health/ready", (_req, res) => res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" }));
app.get("/metrics", (_req, res) => res.type("text/plain; version=0.0.4").send(metrics()));
app.get("/openapi.json", (_req, res) => res.json(openApiDocument));

app.use("/api", (req, res, next) => {
  const now = Date.now();
  const key = req.ip ?? "unknown";
  const current = rateBuckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + config.rateLimitWindowMs } : current;
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  res.setHeader("ratelimit-limit", config.rateLimitMax);
  res.setHeader("ratelimit-remaining", Math.max(0, config.rateLimitMax - bucket.count));
  res.setHeader("ratelimit-reset", Math.ceil(bucket.resetAt / 1000));
  if (bucket.count > config.rateLimitMax) return next(new HttpError("Too many requests.", 429, "RATE_LIMITED"));
  next();
});

const v1 = express.Router();
v1.get("/flags", async (req, res, next) => {
  try {
    const { q, limit, offset } = parseListQuery(req.query as Record<string, unknown>);
    const all = await listFlags();
    const term = q.toLowerCase();
    const filtered = term ? all.filter((flag) => [flag.name, flag.key, flag.description].join(" ").toLowerCase().includes(term)) : all;
    res.json({ data: filtered.slice(offset, offset + limit), pagination: { limit, offset, total: filtered.length } });
  } catch (error) { next(error); }
});
v1.post("/flags", async (req, res, next) => {
  try { res.status(201).json(await createFlag(parseCreateFlag(req.body))); }
  catch (error) { next(error); }
});
v1.patch("/flags/:id", async (req, res, next) => {
  try { res.json(await setFlagEnabled(req.params.id, parseEnabled(req.body))); }
  catch (error) { next(error); }
});
app.use("/api/v1", v1);

// Compatibility aliases; new integrations should use /api/v1.
app.get("/api/flags", async (_req, res, next) => { try { res.json(await listFlags()); } catch (error) { next(error); } });
app.post("/api/flags", async (req, res, next) => { try { res.status(201).json(await createFlag(parseCreateFlag(req.body))); } catch (error) { next(error); } });
app.patch("/api/flags/:id", async (req, res, next) => { try { res.json(await setFlagEnabled(req.params.id, parseEnabled(req.body))); } catch (error) { next(error); } });

app.use("/api", (_req, _res, next) => next(new HttpError("API route not found.", 404, "NOT_FOUND")));
app.use(express.static(distDir));
app.get("*", (req, res, next) => {
  if (!req.accepts("html")) return next(new HttpError("Route not found.", 404, "NOT_FOUND"));
  res.sendFile(path.join(distDir, "index.html"), (error) => error ? next(new HttpError("UI has not been built.", 404, "UI_NOT_BUILT")) : undefined);
});

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const known = error instanceof HttpError;
  const status = known ? error.status : error instanceof SyntaxError ? 400 : 500;
  const code = known ? error.code : status === 400 ? "INVALID_JSON" : "INTERNAL_ERROR";
  const message = known ? error.message : status === 400 ? "Request body contains invalid JSON." : "An unexpected error occurred.";
  if (status >= 500) log("error", "request_failed", { requestId: req.requestId, error: error instanceof Error ? error.stack : String(error) });
  res.status(status).json({ error: { code, message, requestId: req.requestId, ...(known && error.details ? { details: error.details } : {}) } });
});

const server = app.listen(config.port, () => {
  ready = true;
  log("info", "server_started", { port: config.port, environment: config.nodeEnv });
});
server.on("error", (error) => {
  log("error", "server_error", { error: error.message });
});

const rateBucketCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}, config.rateLimitWindowMs);
rateBucketCleanup.unref();

function shutdown(signal: string): void {
  if (!ready) return;
  ready = false;
  clearInterval(rateBucketCleanup);
  log("info", "shutdown_started", { signal });
  const timer = setTimeout(() => { log("error", "shutdown_forced"); process.exit(1); }, config.shutdownTimeoutMs);
  timer.unref();
  server.close((error) => {
    clearTimeout(timer);
    if (error) { log("error", "shutdown_failed", { error: error.message }); process.exit(1); }
    log("info", "shutdown_complete");
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
