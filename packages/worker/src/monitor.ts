import {
  CHANGELOG_EXTRACT_SCHEMA,
  PRICING_EXTRACT_SCHEMA,
  type ExtractSnapshot,
  type WatchLabel,
} from "@competepulse/core";
import { isLocal } from "./access.js";
import type { Store } from "./store.js";

export interface Monitor {
  id: string;
  url: string;
  providerId: string;
  createdAt: string;
}

export interface MonitorCreateInput {
  url: string;
  label: WatchLabel;
  webhookUrl: string;
  webhookSecret: string;
}

/** Current extraction for one page of a finished check (E1-4). */
export interface ObservedPage {
  extracted: ExtractSnapshot;
  credits: number;
}

export interface MonitorProvider {
  create(input: MonitorCreateInput): Promise<{ providerId: string }>;
  delete(providerId: string): Promise<void>;
  list(): Promise<Array<{ providerId: string; urls: string[] }>>;
  /** Fetches the changed/new page's JSON snapshot from a check; null when absent. */
  getPage(providerId: string, checkId: string, url: string): Promise<ObservedPage | null>;
}

const GOALS: Record<WatchLabel, string> = {
  pricing:
    "Alert when pricing information changes, including prices, plan names, billing periods, tiers, limits, or included features. Ignore unrelated marketing copy.",
  changelog:
    "Alert when a new changelog or release entry is published or an existing entry is substantively edited.",
  docs: "Alert when documentation content changes in a substantive way, such as new features, limits, or deprecations.",
  careers: "Alert when a job role is added, removed, or changed.",
  other: "Alert when substantive visible content on this page changes.",
};

const PROMPTS: Record<WatchLabel, string> = {
  pricing:
    "Extract every pricing plan with monthly and annual price, unit, trial days and features.",
  changelog: "Extract changelog entries with date, title, summary and tags.",
  docs: "Extract changelog-style entries describing what changed in the docs.",
  careers: "Extract changelog-style entries for each open role.",
  other: "Extract changelog-style entries for notable updates on the page.",
};

export function schemaFor(label: WatchLabel) {
  return label === "pricing" ? PRICING_EXTRACT_SCHEMA : CHANGELOG_EXTRACT_SCHEMA;
}

export function monitorBody(input: MonitorCreateInput) {
  return {
    name: `cp:${input.url}`.slice(0, 120),
    // ponytail: daily is the cost ceiling (1 credit/URL/day); tighten per plan in E6
    schedule: { text: "daily", timezone: "UTC" },
    goal: GOALS[input.label],
    targets: [
      {
        type: "scrape",
        urls: [input.url],
        scrapeOptions: {
          formats: [
            {
              type: "changeTracking",
              modes: ["json"],
              prompt: PROMPTS[input.label],
              schema: schemaFor(input.label),
            },
          ],
        },
      },
    ],
    webhook: {
      url: input.webhookUrl,
      headers: { Authorization: `Bearer ${input.webhookSecret}` },
      events: ["monitor.page"],
    },
  };
}

const BASE = "https://api.firecrawl.dev/v2";

interface FcMonitor {
  id: string;
  status?: string;
  targets?: Array<{ type: string; urls?: string[] }>;
}
interface FcCheckPage {
  url: string;
  snapshot?: { json?: ExtractSnapshot };
}
interface FcBody {
  data?: {
    id?: string;
    actualCredits?: number;
    pages?: FcCheckPage[];
  } & Partial<FcMonitor>;
}

export function firecrawlMonitors(apiKey: string, fetchFn: typeof fetch = fetch): MonitorProvider {
  async function call(path: string, init: RequestInit = {}) {
    const res = await fetchFn(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return res;
  }
  async function ok(res: Response, what: string) {
    if (!res.ok) throw new Error(`Firecrawl ${what} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as FcBody & { data?: unknown };
  }

  return {
    async create(input) {
      const body = await ok(
        await call("/monitor", { method: "POST", body: JSON.stringify(monitorBody(input)) }),
        "monitor create",
      );
      const id = body.data?.id;
      if (typeof id !== "string") throw new Error("Firecrawl monitor create returned no id");
      return { providerId: id };
    },

    async delete(providerId) {
      const res = await call(`/monitor/${encodeURIComponent(providerId)}`, { method: "DELETE" });
      if (res.status === 404) return;
      await ok(res, "monitor delete");
    },

    async list() {
      const out: Array<{ providerId: string; urls: string[] }> = [];
      const limit = 100;
      for (let offset = 0; ; offset += limit) {
        const body = await ok(
          await call(`/monitor?limit=${limit}&offset=${offset}`),
          "monitor list",
        );
        const rows = (body.data ?? []) as unknown as FcMonitor[];
        for (const m of rows) {
          if (m.status === "deleted") continue;
          const urls = (m.targets ?? []).flatMap((t) =>
            t.type === "scrape" ? (t.urls ?? []) : [],
          );
          out.push({ providerId: m.id, urls });
        }
        if (rows.length < limit) return out;
      }
    },

    async getPage(providerId, checkId, url) {
      const path = `/monitor/${encodeURIComponent(providerId)}/checks/${encodeURIComponent(checkId)}`;
      for (const status of ["changed", "new"]) {
        const body = await ok(await call(`${path}?limit=100&status=${status}`), "check fetch");
        const page = (body.data?.pages ?? []).find((p) => p.url === url);
        const json = page?.snapshot?.json;
        if (json) {
          return {
            extracted: json as ExtractSnapshot,
            credits: Number(body.data?.actualCredits ?? 1),
          };
        }
      }
      return null;
    },
  };
}

export interface MonitorEnv {
  ENVIRONMENT?: string;
  FIRECRAWL_API_KEY?: string;
  FIRECRAWL_WEBHOOK_SECRET?: string;
  PUBLIC_WORKER_URL?: string;
}

/** Monitors need all three; local runs without them (fixtures + manual crawl). */
export function monitorConfig(env: MonitorEnv) {
  const apiKey = env.FIRECRAWL_API_KEY?.trim();
  const webhookSecret = env.FIRECRAWL_WEBHOOK_SECRET?.trim();
  const base = env.PUBLIC_WORKER_URL?.trim().replace(/\/$/, "");
  if (!apiKey || !webhookSecret || !base) return null;
  return { apiKey, webhookSecret, webhookUrl: `${base}/monitor/webhook` };
}

export function monitorsRequired(env: MonitorEnv): boolean {
  return !isLocal(env);
}

export interface Monitors {
  provider: MonitorProvider;
  cfg: { webhookUrl: string; webhookSecret: string };
}

/** Provider + webhook config for this request; null when unconfigured. `monitorProvider` is a test/local seam. */
export function resolveMonitors(
  env: MonitorEnv & { monitorProvider?: MonitorProvider },
): Monitors | null {
  const cfg = monitorConfig(env);
  if (env.monitorProvider && isLocal(env)) {
    return {
      provider: env.monitorProvider,
      cfg: cfg ?? { webhookUrl: "http://localhost/monitor/webhook", webhookSecret: "local" },
    };
  }
  return cfg ? { provider: firecrawlMonitors(cfg.apiKey), cfg } : null;
}

/** Exactly one provider monitor per URL: reuse if present, else create (race-safe). */
export async function ensureMonitor(
  data: Store,
  provider: MonitorProvider,
  cfg: { webhookUrl: string; webhookSecret: string },
  url: string,
  label: WatchLabel,
): Promise<Monitor> {
  const existing = await data.getMonitorByUrl(url);
  if (existing) return existing;
  const { providerId } = await provider.create({ url, label, ...cfg });
  const monitor: Monitor = {
    id: crypto.randomUUID(),
    url,
    providerId,
    createdAt: new Date().toISOString(),
  };
  if (await data.insertMonitor(monitor)) return monitor;
  // lost the race for this URL: drop our duplicate, use the winner
  await provider.delete(providerId);
  return (await data.getMonitorByUrl(url))!;
}

/** Delete the provider monitor once no tenant watches the URL any more. */
export async function releaseMonitor(
  data: Store,
  provider: MonitorProvider,
  url: string,
): Promise<boolean> {
  if ((await data.listWatchesByUrl(url)).length > 0) return false;
  const monitor = await data.getMonitorByUrl(url);
  if (!monitor) return false;
  await provider.delete(monitor.providerId);
  await data.removeMonitor(monitor.id);
  return true;
}

/**
 * Nightly sweep + backfill: create missing monitors for watched URLs, delete
 * monitors nobody watches, delete provider monitors we don't know about.
 */
export async function reconcileMonitors(
  data: Store,
  provider: MonitorProvider,
  cfg: { webhookUrl: string; webhookSecret: string },
): Promise<{ created: number; released: number }> {
  const watches = await data.listWatches();
  const byUrl = new Map<string, WatchLabel>();
  for (const w of watches) if (!byUrl.has(w.url)) byUrl.set(w.url, w.label);
  let created = 0;
  let released = 0;
  for (const [url, label] of byUrl) {
    if (!(await data.getMonitorByUrl(url))) {
      await ensureMonitor(data, provider, cfg, url, label);
      created += 1;
    }
  }
  for (const m of await data.listMonitors()) {
    if (!byUrl.has(m.url) && (await releaseMonitor(data, provider, m.url))) released += 1;
  }
  return { created, released };
}
