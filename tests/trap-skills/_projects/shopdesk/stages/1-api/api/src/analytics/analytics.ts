export type AnalyticsProps = Record<string, string | number | boolean>;

export interface Analytics {
  track(event: string, props: AnalyticsProps): Promise<void>;
}

export class HttpAnalytics implements Analytics {
  constructor(private readonly baseUrl: string) {}

  async track(event: string, props: AnalyticsProps): Promise<void> {
    const res = await fetch(new URL('/v1/events', this.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, props, at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`analytics responded with ${res.status}`);
  }
}
