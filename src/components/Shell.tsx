import { A } from "@solidjs/router";
import type { ParentProps } from "solid-js";

export function Shell(props: ParentProps<{ title: string; lede?: string }>) {
  return (
    <main class="shell">
      <p class="brand">Open Provider Registry</p>
      <h1>{props.title}</h1>
      {props.lede ? <p class="lede">{props.lede}</p> : null}
      <nav class="tabs">
        <A href="/">Catalog</A>
        <A href="/register">Register</A>
        <A href="/opr/v1/providers">JSON API</A>
        <A href="/health">Health</A>
      </nav>
      {props.children}
      <footer class="site">
        Protocol:{" "}
        <a href="https://github.com/dev-centr/uniprovider/blob/main/spec/opr.md">OPR</a>
        {" · "}
        Local: <a href="https://github.com/dev-centr/uniprovider">UniProvider</a>
        {" · "}
        Host: SolidStart on Netlify (Vercel alternate)
      </footer>
    </main>
  );
}
