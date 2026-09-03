import { Title } from "@solidjs/meta";
import { createSignal } from "solid-js";
import { Shell } from "~/components/Shell";

export default function RegisterPage() {
  const [out, setOut] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const tags = String(fd.get("tags") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const body = {
      opr_version: 1,
      id: fd.get("id"),
      display_name: fd.get("display_name") || fd.get("id"),
      class: fd.get("class"),
      base_url: fd.get("base_url"),
      api_format: fd.get("api_format") || "openai",
      keyless: true,
      tags,
      homepage: fd.get("homepage") || undefined,
    };
    setBusy(true);
    try {
      const res = await fetch("/opr/v1/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setOut(JSON.stringify(json, null, 2));
    } catch (err) {
      setOut(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Title>Register · OPR Directory</Title>
      <Shell
        title="Register a provider"
        lede="Publicly reachable endpoints only. Localhost and private LAN URLs are rejected — use UniProvider on the machine for those."
      >
        <p class="warn">
          Save the <code>manage_token</code> returned by the API. It is shown once and required for
          updates.
        </p>
        <form class="card" onSubmit={onSubmit}>
          <label>
            id
            <input name="id" required pattern="[a-z0-9][a-z0-9.-]*" placeholder="acme-gateway" />
          </label>
          <label>
            display_name
            <input name="display_name" placeholder="Acme Gateway" />
          </label>
          <label>
            class
            <select name="class">
              <option value="online">online</option>
              <option value="hybrid">hybrid</option>
              <option value="offline">offline</option>
            </select>
          </label>
          <label>
            base_url
            <input name="base_url" required placeholder="https://api.example.com/v1" />
          </label>
          <label>
            api_format
            <input name="api_format" value="openai" />
          </label>
          <label>
            tags (comma-separated)
            <input name="tags" placeholder="openai-compat, public" />
          </label>
          <label>
            homepage
            <input name="homepage" placeholder="https://example.com" />
          </label>
          <button type="submit" disabled={busy()}>
            {busy() ? "Registering…" : "Register"}
          </button>
        </form>
        {out() ? <pre>{out()}</pre> : null}
      </Shell>
    </>
  );
}
