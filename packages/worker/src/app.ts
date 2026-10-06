import { Hono } from "hono";
import { processCrawlJob } from "./crawl.js";
import { dashboardHtml } from "./dashboard.js";
import { getStore } from "./get-store.js";
import { crawlQueue } from "./queue.js";
import { memorySnapshots } from "./r2.js";
import { registerBattlecards } from "./routes/battlecards.js";
import { registerBilling } from "./routes/billing.js";
import { registerSlack } from "./routes/slack.js";
import { registerWatches } from "./routes/watches.js";
import { registerWorkspaces } from "./routes/workspaces.js";
import { requireAccess, type Env } from "./shared.js";

export type { Env } from "./shared.js";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  crawlQueue.setHandler(async (job) => {
    // ponytail: in-memory queue is local-only (fanout route 503s elsewhere), so fixtures are safe here
    await processCrawlJob(job, { data: getStore(), bucket: memorySnapshots, allowFixtures: true });
  });
  crawlQueue.setDelay(async () => {});

  app.get("/health", async (c) => {
    const data = getStore(c.env);
    return c.json({
      status: "ok",
      service: "competepulse-worker",
      watches: (await data.listWatches()).length,
      workspaces: (await data.listWorkspaces()).length,
      store: c.env.DB ? "d1" : "memory",
    });
  });

  app.get("/dashboard", async (c) => {
    const denied = await requireAccess(c);
    if (denied) return denied;
    return c.html(dashboardHtml());
  });
  app.get("/", (c) => c.redirect("/dashboard"));

  registerSlack(app);
  registerWorkspaces(app);
  registerWatches(app);
  registerBattlecards(app);
  registerBilling(app);

  return app;
}
