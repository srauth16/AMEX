import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FeatureFlag } from "../shared/types.js";
import { HttpError } from "./httpError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "flags.json");

const KEY_PATTERN = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/;

function now(): string {
  return new Date().toISOString();
}

function isFeatureFlag(value: unknown): value is FeatureFlag {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const flag = value as Record<string, unknown>;
  return (
    typeof flag.id === "string" &&
    typeof flag.key === "string" &&
    typeof flag.name === "string" &&
    typeof flag.description === "string" &&
    typeof flag.enabled === "boolean" &&
    typeof flag.createdAt === "string" &&
    typeof flag.updatedAt === "string"
  );
}

function seedFlags(): FeatureFlag[] {
  const createdAt = now();
  return [
    {
      id: randomUUID(),
      key: "checkout-redesign",
      name: "Checkout redesign",
      description: "Roll out the new checkout flow to users.",
      enabled: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: randomUUID(),
      key: "rewards-multiplier",
      name: "Rewards multiplier",
      description: "Show bonus points messaging on eligible purchases.",
      enabled: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: randomUUID(),
      key: "dark-mode",
      name: "Dark mode",
      description: "Enable dark theme in the customer portal.",
      enabled: true,
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

async function ensureStore(): Promise<FeatureFlag[]> {
  await mkdir(dataDir, { recursive: true });
  try {
    const parsed: unknown = JSON.parse(await readFile(dataFile, "utf8"));
    if (!Array.isArray(parsed) || !parsed.every(isFeatureFlag)) {
      throw new Error("Invalid store");
    }
    return parsed;
  } catch {
    const flags = seedFlags();
    await writeFile(dataFile, JSON.stringify(flags, null, 2));
    return flags;
  }
}

async function save(flags: FeatureFlag[]): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(flags, null, 2));
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function listFlags(): Promise<FeatureFlag[]> {
  const flags = await ensureStore();
  return [...flags].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFlag(input: unknown): Promise<FeatureFlag> {
  const body = typeof input === "object" && input !== null ? input : {};
  const record = body as Record<string, unknown>;

  const trimmedKey = readString(record.key).trim().toLowerCase();
  const trimmedName = readString(record.name).trim();
  const trimmedDescription = readString(record.description).trim();

  if (!trimmedName) {
    throw new HttpError("Name is required.", 400);
  }

  if (!KEY_PATTERN.test(trimmedKey)) {
    throw new HttpError(
      "Key must start with a letter and use only lowercase letters, numbers, hyphens, or underscores.",
      400
    );
  }

  const flags = await ensureStore();
  if (flags.some((flag) => flag.key === trimmedKey)) {
    throw new HttpError("A flag with this key already exists.", 409);
  }

  const createdAt = now();
  const flag: FeatureFlag = {
    id: randomUUID(),
    key: trimmedKey,
    name: trimmedName,
    description: trimmedDescription,
    enabled: Boolean(record.enabled),
    createdAt,
    updatedAt: createdAt,
  };

  flags.push(flag);
  await save(flags);
  return flag;
}

export async function setFlagEnabled(
  id: string,
  enabled: unknown
): Promise<FeatureFlag> {
  if (typeof enabled !== "boolean") {
    throw new HttpError("enabled must be true or false.", 400);
  }

  const flags = await ensureStore();
  const flag = flags.find((item) => item.id === id);
  if (!flag) {
    throw new HttpError("Flag not found.", 404);
  }

  flag.enabled = enabled;
  flag.updatedAt = now();
  await save(flags);
  return flag;
}
