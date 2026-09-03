import type { ModelRef, ProviderClass, ProviderWrite } from "./types";

const ID_RE = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[::1\]|::1)/i;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isProviderClass(v: string): v is ProviderClass {
  return v === "online" || v === "offline" || v === "hybrid";
}

export function normalizeModels(raw: ProviderWrite["models"]): ModelRef[] {
  if (!raw) return [];
  return raw.map((m) => {
    if (typeof m === "string") return { id: m, name: m };
    return { id: m.id, name: m.name ?? m.id };
  });
}

/** Public directory must not advertise loopback/LAN endpoints. */
export function assertPublicBaseUrl(baseUrl: string): void {
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    throw new ValidationError("base_url must be an absolute URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new ValidationError("base_url must be http or https");
  }
  const host = u.hostname;
  if (PRIVATE_HOST.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ValidationError(
      "base_url must be publicly reachable (no localhost / private LAN). Use local UniProvider for on-machine runners.",
    );
  }
}

export function validateWrite(body: unknown): ProviderWrite {
  if (!body || typeof body !== "object") throw new ValidationError("JSON object required");
  const b = body as Record<string, unknown>;
  const id = String(b.id ?? "").trim().toLowerCase();
  if (!ID_RE.test(id)) {
    throw new ValidationError("id must match [a-z0-9][a-z0-9.-]* (max 64)");
  }
  const klass = String(b.class ?? "");
  if (!isProviderClass(klass)) {
    throw new ValidationError("class must be online | offline | hybrid");
  }
  const base_url = String(b.base_url ?? b.baseUrl ?? "").trim();
  if (!base_url) throw new ValidationError("base_url required");
  assertPublicBaseUrl(base_url);

  return {
    opr_version: b.opr_version !== undefined ? Number(b.opr_version) : 1,
    id,
    display_name: String(b.display_name ?? b.name ?? id).trim(),
    class: klass,
    base_url,
    api_format: String(b.api_format ?? b.apiFormat ?? "openai").trim() || "openai",
    keyless: b.keyless === undefined ? true : Boolean(b.keyless),
    tags: Array.isArray(b.tags) ? b.tags.map((t) => String(t)) : [],
    models: normalizeModels(b.models as ProviderWrite["models"]),
    homepage: b.homepage ? String(b.homepage) : undefined,
    contact: b.contact ? String(b.contact) : undefined,
  };
}

export function rowToPublic(row: Record<string, unknown>) {
  return {
    opr_version: Number(row.opr_version),
    id: String(row.id),
    display_name: String(row.display_name),
    class: row.class as ProviderClass,
    base_url: String(row.base_url),
    api_format: String(row.api_format),
    keyless: Boolean(Number(row.keyless)),
    tags: JSON.parse(String(row.tags_json || "[]")) as string[],
    models: JSON.parse(String(row.models_json || "[]")) as ModelRef[],
    homepage: row.homepage ? String(row.homepage) : undefined,
    contact: row.contact ? String(row.contact) : undefined,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
