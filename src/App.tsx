import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFlag, fetchFlags, updateFlagEnabled } from "./api";
import type { CreateFlagPayload, FeatureFlag } from "../shared/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function toKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const emptyForm: CreateFlagPayload = {
  name: "",
  key: "",
  description: "",
  enabled: false,
};

export default function App() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<CreateFlagPayload>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function loadFlags() {
    setError("");
    const data = await fetchFlags();
    setFlags(data);
  }

  useEffect(() => {
    loadFlags()
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return flags;
    return flags.filter((flag) =>
      [flag.name, flag.key, flag.description].join(" ").toLowerCase().includes(term)
    );
  }, [flags, query]);

  const enabledCount = flags.filter((flag) => flag.enabled).length;

  function onNameChange(name: string) {
    setForm((current) => {
      const shouldSyncKey = !current.key || current.key === toKey(current.name);
      return {
        ...current,
        name,
        key: shouldSyncKey ? toKey(name) : current.key,
      };
    });
  }

  async function onToggle(flag: FeatureFlag) {
    const nextEnabled = !flag.enabled;
    setPendingIds((current) => new Set(current).add(flag.id));
    setError("");
    try {
      const updated = await updateFlagEnabled(flag.id, nextEnabled);
      setFlags((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setNotice(`${updated.name} is now ${updated.enabled ? "on" : "off"}.`);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(flag.id);
        return next;
      });
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createFlag(form);
      setFlags((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setForm(emptyForm);
      setNotice(`Created ${created.name}.`);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Control plane</p>
        <h1>Feature Flag Manager</h1>
        <p className="lede">
          View flags, turn them on or off, and create new ones. Changes persist on
          the server.
        </p>
        <dl className="stats">
          <div>
            <dt>Total</dt>
            <dd>{loading ? "—" : flags.length}</dd>
          </div>
          <div>
            <dt>Enabled</dt>
            <dd>{loading ? "—" : enabledCount}</dd>
          </div>
          <div>
            <dt>Disabled</dt>
            <dd>{loading ? "—" : flags.length - enabledCount}</dd>
          </div>
        </dl>
      </header>

      {(error || notice) && (
        <div className="banners" role="status">
          {error && <p className="banner error">{error}</p>}
          {notice && !error && <p className="banner notice">{notice}</p>}
        </div>
      )}

      <section className="layout">
        <form className="panel create" onSubmit={onCreate}>
          <div className="panel-head">
            <h2>Create flag</h2>
            <p>Give it a human name and a stable key other services can look up.</p>
          </div>

          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="New billing page"
              required
            />
          </label>

          <label>
            Key
            <input
              value={form.key}
              onChange={(event) =>
                setForm((current) => ({ ...current, key: event.target.value }))
              }
              placeholder="new-billing-page"
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="What this flag controls"
              rows={3}
            />
          </label>

          <label className="switch-row">
            <span>Start enabled</span>
            <button
              type="button"
              className={`switch ${form.enabled ? "on" : ""}`}
              role="switch"
              aria-checked={form.enabled}
              onClick={() =>
                setForm((current) => ({ ...current, enabled: !current.enabled }))
              }
            >
              <span className="knob" />
            </button>
          </label>

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create flag"}
          </button>
        </form>

        <div className="panel list">
          <div className="panel-head row">
            <div>
              <h2>Flags</h2>
              <p>
                {loading
                  ? "Loading flags…"
                  : `${filtered.length} shown${query ? ` for “${query}”` : ""}`}
              </p>
            </div>
            <input
              className="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, key, or description"
              aria-label="Search flags"
            />
          </div>

          {loading ? (
            <p className="empty">Fetching flags from the server.</p>
          ) : filtered.length === 0 ? (
            <p className="empty">
              {flags.length === 0
                ? "No flags yet. Create one to get started."
                : "No flags match that search."}
            </p>
          ) : (
            <ul className="flag-list">
              {filtered.map((flag) => (
                <li key={flag.id} className="flag">
                  <div className="flag-copy">
                    <div className="flag-title">
                      <h3>{flag.name}</h3>
                      <span className={`pill ${flag.enabled ? "on" : "off"}`}>
                        {flag.enabled ? "On" : "Off"}
                      </span>
                    </div>
                    <code>{flag.key}</code>
                    {flag.description && <p>{flag.description}</p>}
                    <p className="meta">Updated {formatDate(flag.updatedAt)}</p>
                  </div>
                  <button
                    type="button"
                    className={`switch large ${flag.enabled ? "on" : ""}`}
                    role="switch"
                    aria-label={`${flag.enabled ? "Disable" : "Enable"} ${flag.name}`}
                    aria-checked={flag.enabled}
                    disabled={pendingIds.has(flag.id)}
                    onClick={() => onToggle(flag)}
                  >
                    <span className="knob" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
