/**
 * Identify which football-data service an API key (env API_FOOTBALL_KEY)
 * belongs to, without ever printing the key itself. Several providers use
 * the same 32-hex key format, so a rejected key usually means "right key,
 * wrong service".
 */
const key = process.env.API_FOOTBALL_KEY;
if (!key) {
  console.error('API_FOOTBALL_KEY env var not set');
  process.exit(1);
}

async function probe(name: string, url: string, headers: Record<string, string>): Promise<void> {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    let summary = `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      if (name === 'api-sports (dashboard.api-football.com)') {
        const errs = JSON.stringify(json.errors ?? {});
        const r = json.response as { subscription?: { plan?: string }; requests?: unknown } | undefined;
        summary += errs !== '{}' && errs !== '[]' ? ` | errors: ${errs}` : ` | AUTHENTICATED, plan: ${r?.subscription?.plan}, requests: ${JSON.stringify(r?.requests)}`;
      } else if (name === 'football-data.org') {
        const comps = json.competitions as { code?: string; name?: string }[] | undefined;
        summary += comps
          ? ` | AUTHENTICATED, ${comps.length} competitions: ${comps.map((c) => c.code).join(',')}`
          : ` | ${JSON.stringify(json.message ?? json).slice(0, 200)}`;
      } else {
        summary += ` | ${text.slice(0, 200)}`;
      }
    } catch {
      summary += ` | ${text.slice(0, 150)}`;
    }
    console.log(`${name}: ${summary}`);
  } catch (e) {
    console.log(`${name}: request failed — ${e instanceof Error ? e.message : e}`);
  }
}

await probe('api-sports (dashboard.api-football.com)', 'https://v3.football.api-sports.io/status', {
  'x-apisports-key': key,
});
await probe('rapidapi (api-football via RapidAPI)', 'https://api-football-v1.p.rapidapi.com/v3/status', {
  'x-rapidapi-key': key,
  'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
});
await probe('football-data.org', 'https://api.football-data.org/v4/competitions', {
  'X-Auth-Token': key,
});
