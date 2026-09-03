import type { APIEvent } from "@solidjs/start/server";
import { bearerToken } from "~/lib/auth";
import { deleteProvider, getProvider, updateProvider } from "~/lib/db";
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

function idFrom(event: APIEvent): string {
  return String(event.params.id ?? "").trim().toLowerCase();
}

export async function GET(event: APIEvent) {
  const id = idFrom(event);
  const provider = await getProvider(id);
  if (!provider) return json({ error: "not found" }, 404);
  return json({ opr_version: 1, provider });
}

export async function PUT(event: APIEvent) {
  return mutate(event);
}

export async function PATCH(event: APIEvent) {
  return mutate(event);
}

async function mutate(event: APIEvent) {
  try {
    const id = idFrom(event);
    const token = bearerToken(event.request);
    if (!token) return json({ error: "Authorization: Bearer <manage_token> required" }, 401);
    const body = validateWrite(await event.request.json());
    if (body.id !== id) return json({ error: "id in path must match body.id" }, 400);
    const result = await updateProvider(id, body, token);
    if (result === "not_found") return json({ error: "not found" }, 404);
    if (result === "forbidden") return json({ error: "forbidden" }, 403);
    return json({ opr_version: 1, provider: result });
  } catch (err) {
    if (err instanceof ValidationError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: "internal error" }, 500);
  }
}

export async function DELETE(event: APIEvent) {
  const id = idFrom(event);
  const token = bearerToken(event.request);
  if (!token) return json({ error: "Authorization: Bearer <manage_token> required" }, 401);
  const result = await deleteProvider(id, token);
  if (result === "not_found") return json({ error: "not found" }, 404);
  if (result === "forbidden") return json({ error: "forbidden" }, 403);
  return json({ opr_version: 1, deleted: id });
}
