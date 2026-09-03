import { defineConfig } from "@solidjs/start/config";

/**
 * SolidStart + Nitro.
 * Local default: node-server (`pnpm start`).
 * Netlify: set OPR_DIRECTORY_NITRO_PRESET=netlify (see netlify.toml).
 * Vercel: set OPR_DIRECTORY_NITRO_PRESET=vercel before build.
 * Cloudflare Workers/D1 intentionally not used.
 */
export default defineConfig({
  ssr: true,
  server: {
    preset: process.env.OPR_DIRECTORY_NITRO_PRESET || "node-server",
  },
});
