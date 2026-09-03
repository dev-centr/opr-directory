import type { APIEvent } from "@solidjs/start/server";
import { bearerToken, clientIp, randomToken } from "~/lib/auth";
import {
  allowRegistration,
  getProvider,
  insertProvider,
  isAdmin,
  listProviders,
} from "~/lib/db";
import { ValidationError, validateWrite } from "~/lib/validate";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}

export async function GET({ request }: APIEvent) {
  const url = new URL(request.url);
  const { providers, total } = await listProviders({
    class: url.searchParams.get("class") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    limit: num(url.searchParams.get("limit")),
    offset: num(url.searchParams.get("offset")),
  });
  return json({ opr_version: 1, total, providers });
}

export async function POST({ request }: APIEvent) {
  try {
    const body = validateWrite(await request.json());
    if (await getProvider(body.id)) {
      return json({ error: "id already registered" }, 409);
    }
    const token = bearerToken(request);
    const ip = clientIp(request);
    if (!isAdmin(token)) {
      if (!(await allowRegistration(ip))) {
        return json({ error: "rate limit: too many registrations from this IP today" }, 429);
      }
    }
    const manage_token = randomToken();
    const provider = await insertProvider(body, manage_token, ip);
    return json(
      {
        opr_version: 1,
        provider,
        manage_token,
        note: "Store manage_token securely. It is not shown again.",
      },
      201,
    );
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: "internal error" }, 500);
  }
}

function num(v: string | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
