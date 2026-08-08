// @ts-check
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

const site = process.env.PUBLIC_SITE_URL ?? "https://competepulse.com";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "never",
  integrations: [sitemap()],
  build: {
    // One small page: inlining the stylesheet removes a render-blocking round trip.
    inlineStylesheets: "always",
  },
  vite: {
    build: {
      /*
       * Emit the Calendly loader as a real file instead of an inline <script>.
       * Calendly's widget calls setAttribute("style", …), which forces
       * `style-src 'unsafe-inline'`; keeping our own JS external is what lets
       * `script-src` in public/_headers stay at 'self' with no hashes to sync.
       */
      assetsInlineLimit: 0,
    },
  },
  devToolbar: { enabled: false },
  compressHTML: true,
  image: {
    // No source images are transformed at build time, so skip the sharp pipeline.
    service: { entrypoint: "astro/assets/services/noop" },
  },
});
