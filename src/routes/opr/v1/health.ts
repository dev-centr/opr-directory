import type { APIEvent } from "@solidjs/start/server";

export function GET(_event: APIEvent) {
  return new Response(
    JSON.stringify({
      ok: true,
      protocol: "opr",
      opr_version: 1,
      service: "opr-directory",
      role: "online-directory",
      host: "solidstart",
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    },
  );
}
