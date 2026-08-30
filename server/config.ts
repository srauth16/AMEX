type Config = {
  port: number;
  nodeEnv: "development" | "test" | "production";
  allowedOrigins: string[];
  jsonLimit: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  shutdownTimeoutMs: number;
};

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (!(["development", "test", "production"] as const).includes(nodeEnv as Config["nodeEnv"])) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowedOrigins.some((origin) => origin !== "*" && !URL.canParse(origin))) {
    throw new Error("ALLOWED_ORIGINS must contain comma-separated absolute URLs.");
  }

  return {
    port: integer("PORT", 3001, 1, 65535),
    nodeEnv: nodeEnv as Config["nodeEnv"],
    allowedOrigins,
    jsonLimit: process.env.JSON_BODY_LIMIT ?? "32kb",
    rateLimitWindowMs: integer("RATE_LIMIT_WINDOW_MS", 60_000, 1_000, 3_600_000),
    rateLimitMax: integer("RATE_LIMIT_MAX", 120, 1, 100_000),
    shutdownTimeoutMs: integer("SHUTDOWN_TIMEOUT_MS", 10_000, 1_000, 60_000),
  };
}
