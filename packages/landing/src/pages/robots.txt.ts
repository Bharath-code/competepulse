import type { APIRoute } from "astro";
import { resolveConfig } from "../lib/config";

/** Generated so the sitemap URL always matches the deployed origin. */
export const GET: APIRoute = () => {
  const { siteUrl } = resolveConfig(import.meta.env);
  const body = ["User-agent: *", "Allow: /", "", `Sitemap: ${siteUrl}/sitemap-index.xml`, ""].join(
    "\n",
  );

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
