import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { sha256Hex } from "./auth";
import type { ProviderPublic, ProviderWrite } from "./types";
import { rowToPublic } from "./validate";

/**
 * Persistence:
 * - Default / local: JSON file (no native deps — works on Windows + Netlify/Vercel).
 * - Remote Turso: set OPR_DIRECTORY_DATABASE_URL to libsql://… or https://… (HTTP client).
 */

type StoreRow = Record<string, unknown>;

type RateRow = { count: number; window_start: string };

type JsonDb = {
  providers: StoreRow[];
  rate_limits: Record<string, RateRow>;
};

type LibsqlClient = {
  execute: (q: { sql: string; args?: (string | number | null)[] } | string) => Promise<{
    rows: Record<string, unknown>[];
  }>;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REG = 20;

function jsonPath(): string {
  return resolve(process.cwd(), process.env.OPR_DIRECTORY_JSON_PATH || ".data/catalog.json");
}

function loadJson(): JsonDb {
  const path = jsonPath();
  if (!existsSync(path)) return { providers: [], rate_limits: {} };
  return JSON.parse(readFileSync(path, "utf8")) as JsonDb;
}

function saveJson(db: JsonDb): void {
  const path = jsonPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(db, null, 2), "utf8");
}

function useLibsql(): boolean {
  const url = process.env.OPR_DIRECTORY_DATABASE_URL || "";
  return /^(libsql|https):\/\//i.test(url);
}

let libsql: LibsqlClient | null = null;
let migrated = false;

async function getLibsql(): Promise<LibsqlClient> {
  if (libsql) return libsql;
  const { createClient } = await import("@libsql/client");
  libsql = createClient({
    url: process.env.OPR_DIRECTORY_DATABASE_URL!,
    authToken: process.env.OPR_DIRECTORY_DATABASE_AUTH_TOKEN || undefined,
  }) as unknown as LibsqlClient;
  return libsql;
}

async function ensureLibsqlSchema(): Promise<void> {
  if (migrated) return;
  const db = await getLibsql();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY NOT NULL,
      opr_version INTEGER NOT NULL DEFAULT 1,
      display_name TEXT NOT NULL,
      class TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_format TEXT NOT NULL DEFAULT 'openai',
      keyless INTEGER NOT NULL DEFAULT 1,
      tags_json TEXT NOT NULL DEFAULT '[]',
      models_json TEXT NOT NULL DEFAULT '[]',
      homepage TEXT,
      contact TEXT,
      manage_token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_ip TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      window_start TEXT NOT NULL
    )
  `);
  migrated = true;
}

export type ListQuery = {
  class?: string;
  tag?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

function filterRows(rows: StoreRow[], query: ListQuery): StoreRow[] {
  let out = rows;
  if (query.class) out = out.filter((r) => r.class === query.class);
  if (query.tag) out = out.filter((r) => String(r.tags_json).includes(`"${query.tag}"`));
  if (query.q) {
    const q = query.q.toLowerCase();
    out = out.filter(
      (r) =>
        String(r.id).toLowerCase().includes(q) ||
        String(r.display_name).toLowerCase().includes(q) ||
        String(r.base_url).toLowerCase().includes(q),
    );
  }
  out = [...out].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return out;
}

export async function listProviders(query: ListQuery = {}): Promise<{
  providers: ProviderPublic[];
  total: number;
}> {
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
  const offset = Math.max(query.offset ?? 0, 0);

  if (useLibsql()) {
    await ensureLibsqlSchema();
    const db = await getLibsql();
    const clauses: string[] = [];
    const args: (string | number | null)[] = [];
    if (query.class) {
      clauses.push("class = ?");
      args.push(query.class);
    }
    if (query.tag) {
      clauses.push("tags_json LIKE ?");
      args.push(`%"${query.tag}"%`);
    }
    if (query.q) {
      clauses.push("(id LIKE ? OR display_name LIKE ? OR base_url LIKE ?)");
      const like = `%${query.q}%`;
      args.push(like, like, like);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const countRs = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM providers ${where}`,
      args,
    });
    const total = Number(countRs.rows[0]?.n ?? 0);
    const rs = await db.execute({
      sql: `SELECT * FROM providers ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });
    return {
      total,
      providers: rs.rows.map((r) => rowToPublic(r as unknown as Record<string, unknown>)),
    };
  }

  const db = loadJson();
  const filtered = filterRows(db.providers, query);
  const slice = filtered.slice(offset, offset + limit);
  return { total: filtered.length, providers: slice.map((r) => rowToPublic(r)) };
}

export async function getProvider(id: string): Promise<ProviderPublic | null> {
  if (useLibsql()) {
    await ensureLibsqlSchema();
    const rs = await (await getLibsql()).execute({
      sql: "SELECT * FROM providers WHERE id = ?",
      args: [id],
    });
    const row = rs.rows[0];
    return row ? rowToPublic(row as unknown as Record<string, unknown>) : null;
  }
  const row = loadJson().providers.find((p) => p.id === id);
  return row ? rowToPublic(row) : null;
}

function writeFields(p: ProviderWrite, manageHash: string, ip: string, existing?: StoreRow): StoreRow {
  const now = new Date().toISOString();
  return {
    id: p.id,
    opr_version: p.opr_version ?? 1,
    display_name: p.display_name ?? p.id,
    class: p.class,
    base_url: p.base_url,
    api_format: p.api_format ?? "openai",
    keyless: p.keyless === false ? 0 : 1,
    tags_json: JSON.stringify(p.tags ?? []),
    models_json: JSON.stringify(p.models ?? []),
    homepage: p.homepage ?? null,
    contact: p.contact ?? null,
    manage_token_hash: manageHash,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    created_ip: existing?.created_ip ?? ip,
  };
}

export async function insertProvider(
  p: ProviderWrite,
  manageToken: string,
  ip: string,
): Promise<ProviderPublic> {
  const hash = sha256Hex(manageToken);
  if (useLibsql()) {
    await ensureLibsqlSchema();
    const row = writeFields(p, hash, ip);
    await (await getLibsql()).execute({
      sql: `INSERT INTO providers (
        id, opr_version, display_name, class, base_url, api_format, keyless,
        tags_json, models_json, homepage, contact, manage_token_hash,
        created_at, updated_at, created_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        row.id,
        row.opr_version,
        row.display_name,
        row.class,
        row.base_url,
        row.api_format,
        row.keyless,
        row.tags_json,
        row.models_json,
        row.homepage,
        row.contact,
        row.manage_token_hash,
        row.created_at,
        row.updated_at,
        row.created_ip,
      ] as (string | number | null)[],
    });
    return (await getProvider(p.id))!;
  }

  const db = loadJson();
  if (db.providers.some((x) => x.id === p.id)) throw new Error("id already registered");
  db.providers.push(writeFields(p, hash, ip));
  saveJson(db);
  return (await getProvider(p.id))!;
}

export async function updateProvider(
  id: string,
  p: ProviderWrite,
  manageToken: string,
): Promise<ProviderPublic | "not_found" | "forbidden"> {
  const hash = sha256Hex(manageToken);
  if (useLibsql()) {
    await ensureLibsqlSchema();
    const rs = await (await getLibsql()).execute({
      sql: "SELECT manage_token_hash FROM providers WHERE id = ?",
      args: [id],
    });
    const row = rs.rows[0];
    if (!row) return "not_found";
    if (String(row.manage_token_hash) !== hash) return "forbidden";
    const now = new Date().toISOString();
    await (await getLibsql()).execute({
      sql: `UPDATE providers SET
        opr_version = ?, display_name = ?, class = ?, base_url = ?, api_format = ?,
        keyless = ?, tags_json = ?, models_json = ?, homepage = ?, contact = ?,
        updated_at = ?
       WHERE id = ?`,
      args: [
        p.opr_version ?? 1,
        p.display_name ?? p.id,
        p.class,
        p.base_url,
        p.api_format ?? "openai",
        p.keyless === false ? 0 : 1,
        JSON.stringify(p.tags ?? []),
        JSON.stringify(p.models ?? []),
        p.homepage ?? null,
        p.contact ?? null,
        now,
        id,
      ],
    });
    return (await getProvider(id))!;
  }

  const db = loadJson();
  const idx = db.providers.findIndex((x) => x.id === id);
  if (idx < 0) return "not_found";
  if (String(db.providers[idx]!.manage_token_hash) !== hash) return "forbidden";
  db.providers[idx] = writeFields(p, hash, String(db.providers[idx]!.created_ip ?? ""), db.providers[idx]);
  saveJson(db);
  return (await getProvider(id))!;
}

export async function deleteProvider(
  id: string,
  manageToken: string,
): Promise<"ok" | "not_found" | "forbidden"> {
  const hash = sha256Hex(manageToken);
  if (useLibsql()) {
    await ensureLibsqlSchema();
    const rs = await (await getLibsql()).execute({
      sql: "SELECT manage_token_hash FROM providers WHERE id = ?",
      args: [id],
    });
    const row = rs.rows[0];
    if (!row) return "not_found";
    if (String(row.manage_token_hash) !== hash) return "forbidden";
    await (await getLibsql()).execute({ sql: "DELETE FROM providers WHERE id = ?", args: [id] });
    return "ok";
  }

  const db = loadJson();
  const idx = db.providers.findIndex((x) => x.id === id);
  if (idx < 0) return "not_found";
  if (String(db.providers[idx]!.manage_token_hash) !== hash) return "forbidden";
  db.providers.splice(idx, 1);
  saveJson(db);
  return "ok";
}

export async function allowRegistration(ip: string): Promise<boolean> {
  const bucket = `reg:${ip}`;
  const now = Date.now();

  if (useLibsql()) {
    await ensureLibsqlSchema();
    const db = await getLibsql();
    const rs = await db.execute({
      sql: "SELECT count, window_start FROM rate_limits WHERE bucket = ?",
      args: [bucket],
    });
    const row = rs.rows[0];
    if (!row) {
      await db.execute({
        sql: "INSERT INTO rate_limits (bucket, count, window_start) VALUES (?, 1, ?)",
        args: [bucket, new Date(now).toISOString()],
      });
      return true;
    }
    const start = Date.parse(String(row.window_start));
    if (Number.isNaN(start) || now - start > WINDOW_MS) {
      await db.execute({
        sql: "UPDATE rate_limits SET count = 1, window_start = ? WHERE bucket = ?",
        args: [new Date(now).toISOString(), bucket],
      });
      return true;
    }
    if (Number(row.count) >= MAX_REG) return false;
    await db.execute({
      sql: "UPDATE rate_limits SET count = count + 1 WHERE bucket = ?",
      args: [bucket],
    });
    return true;
  }

  const db = loadJson();
  const row = db.rate_limits[bucket];
  if (!row) {
    db.rate_limits[bucket] = { count: 1, window_start: new Date(now).toISOString() };
    saveJson(db);
    return true;
  }
  const start = Date.parse(row.window_start);
  if (Number.isNaN(start) || now - start > WINDOW_MS) {
    db.rate_limits[bucket] = { count: 1, window_start: new Date(now).toISOString() };
    saveJson(db);
    return true;
  }
  if (row.count >= MAX_REG) return false;
  row.count += 1;
  saveJson(db);
  return true;
}

export function isAdmin(token: string | null): boolean {
  const admin = process.env.OPR_DIRECTORY_ADMIN_TOKEN;
  return Boolean(admin && token && token === admin);
}
