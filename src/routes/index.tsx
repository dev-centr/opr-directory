import { Title } from "@solidjs/meta";
import { createResource, For, Show } from "solid-js";
import { Shell } from "~/components/Shell";
import type { ProviderPublic } from "~/lib/types";

async function fetchProviders(): Promise<{ providers: ProviderPublic[]; total: number }> {
  "use server";
  const { listProviders } = await import("~/lib/db");
  return listProviders({ limit: 100 });
}

export default function Home() {
  const [data] = createResource(fetchProviders);

  return (
    <>
      <Title>OPR Directory</Title>
      <Shell
        title="OPR Directory"
        lede="Public catalog of model provider endpoints. Apps poll; runners register once. Not a token marketplace and not a proxy."
      >
        <Show when={data.loading}>
          <p class="meta">Loading catalog…</p>
        </Show>
        <Show when={data.error}>
          <p class="warn">Could not load providers. Is the database URL configured?</p>
        </Show>
        <Show when={data()}>
          {(d) => (
            <>
              <h2>Providers ({d().total})</h2>
              <Show
                when={d().providers.length}
                fallback={
                  <p class="meta">
                    No providers yet. Register via <a href="/register">/register</a> or{" "}
                    <code>POST /opr/v1/providers</code>.
                  </p>
                }
              >
                <For each={d().providers}>
                  {(p) => (
                    <article class="card">
                      <strong>{p.display_name}</strong>
                      <span class="meta">
                        {" "}
                        · {p.id} · {p.class} · {p.api_format}
                      </span>
                      <div class="meta">
                        <code>{p.base_url}</code>
                      </div>
                      <Show when={p.tags.length}>
                        <div class="meta">{p.tags.join(" · ")}</div>
                      </Show>
                    </article>
                  )}
                </For>
              </Show>
              <h2>Poll</h2>
              <pre>{"curl -s $ORIGIN/opr/v1/providers"}</pre>
            </>
          )}
        </Show>
      </Shell>
    </>
  );
}
