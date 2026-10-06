export interface AnalyticsEnv {
  /** PostHog project API key (public capture key). Unset → tracking is a no-op. */
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
}

/** Funnel: install → alert_delivered → response_approved → paid. distinct_id = workspace id. */
export type FunnelEvent = "install" | "alert_delivered" | "response_approved" | "paid";

export async function track(
  env: AnalyticsEnv,
  event: FunnelEvent,
  workspaceId: string,
  properties: Record<string, unknown> = {},
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!env.POSTHOG_API_KEY) return;
  try {
    await fetcher(`${env.POSTHOG_HOST ?? "https://us.i.posthog.com"}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.POSTHOG_API_KEY,
        event,
        distinct_id: workspaceId,
        properties: { ...properties, $process_person_profile: false },
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch (err) {
    console.error(JSON.stringify({ event: "analytics_failed", name: event, err: String(err) }));
  }
}
