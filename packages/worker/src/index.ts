import { createApp, type Env } from "./app.js";
import { runAllWorkspaceDigests } from "./digest.js";
import { store } from "./store.js";

const app = createApp();

export default {
  fetch: app.fetch.bind(app),

  /** Weekday digest cron (E1-4). Idempotent per workspace/day. */
  async scheduled(
    _controller: ScheduledController,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    runAllWorkspaceDigests(store, new Date());
  },
};
