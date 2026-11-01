export type ResearchQuery = {
  platform: 'web' | 'x' | 'instagram' | 'youtube' | 'news';
  phase: 'anticipation' | 'event' | 'aftermath' | 'retrospective';
  query: string;
  dateFrom: string | null;
  dateTo: string | null;
};

export type DiscoveredSource = {
  title: string;
  url: string;
  snippet: string | null;
  platform: string;
  phase: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  verificationStatus: 'unverified';
};


/** Normalize search-engine result URLs to the actual publisher destination. */
function normalizeResultUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    let parsed = new URL(raw.trim().replace(/&amp;/gi, '&'));
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

    // Google sometimes exposes its own /url redirect rather than the publisher URL.
    if (/(^|\.)google\.[^/.]+$/i.test(parsed.hostname) && parsed.pathname === '/url') {
      const destination = parsed.searchParams.get('q') ?? parsed.searchParams.get('url') ?? parsed.searchParams.get('uddg');
      if (destination) {
        parsed = new URL(destination);
      } else {
        return null;
      }
      if (destination) {
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      }
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    // A search page, cache, or API endpoint is not a usable article destination.
    if (host === 'google.com' || host === 'news.google.com' || host === 'serpapi.com' || host === 'webcache.googleusercontent.com') return null;

    // Remove tracking-only parameters while preserving publisher article IDs and query data.
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_.+|gclid|dclid|fbclid|mc_cid|mc_eid|igshid|ref_src|ref_url)$/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function decodeCommonEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function dateFilter(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const format = (value: string) => {
    const [year, month, day] = value.split('-');
    return `${month}/${day}/${year}`;
  };
  return `cdr:1,cd_min:${format(from)},cd_max:${format(to)}`;
}

async function searchSerpApi(query: ResearchQuery): Promise<DiscoveredSource[]> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key || query.platform === 'youtube') return [];

  const site = query.platform === 'x' ? 'site:x.com OR site:twitter.com'
    : query.platform === 'instagram' ? 'site:instagram.com'
    : '';
  const params = new URLSearchParams({ engine: 'google', api_key: key, q: `${site} ${query.query}`.trim(), num: '8' });
  if (query.platform === 'news') params.set('tbm', 'nws');
  const tbs = dateFilter(query.dateFrom, query.dateTo);
  if (tbs) params.set('tbs', tbs);

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`SerpApi returned ${response.status}`);
  const data = await response.json() as {
    organic_results?: Array<{ title?: string; link?: string; snippet?: string; date?: string; thumbnail?: string }>;
    news_results?: Array<{ title?: string; link?: string; snippet?: string; date?: string; thumbnail?: string; source?: { name?: string } }>;
  };

  // SerpApi's news_results contains publisher destinations; organic_results is the fallback.
  const resultItems = query.platform === 'news'
    ? [...(data.news_results ?? []), ...(data.organic_results ?? [])]
    : (data.organic_results ?? []);

  return resultItems.flatMap((item) => {
    const url = normalizeResultUrl(item.link);
    if (!url) return [];
    return [{
    title: decodeCommonEntities(item.title ?? url),
    url,
    snippet: item.snippet ? decodeCommonEntities(item.snippet) : null,
    platform: query.platform,
    phase: query.phase,
    // Google snippets may show a date, but it is not a verified original publication timestamp.
    publishedAt: null,
    thumbnailUrl: normalizeResultUrl(item.thumbnail ?? undefined),
    verificationStatus: 'unverified' as const,
  }];
  });
}

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
    };
  }>;
};

async function searchYouTube(query: ResearchQuery): Promise<DiscoveredSource[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || query.platform !== 'youtube') return [];

  const params = new URLSearchParams({
    key,
    part: 'snippet',
    type: 'video',
    maxResults: '8',
    order: 'relevance',
    q: query.query,
  });
  if (query.dateFrom) params.set('publishedAfter', `${query.dateFrom}T00:00:00Z`);
  if (query.dateTo) params.set('publishedBefore', `${query.dateTo}T23:59:59Z`);

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`YouTube Data API returned ${response.status}`);
  const data = await response.json() as YouTubeSearchResponse;

  return (data.items ?? []).flatMap((item) => {
    const videoId = item.id?.videoId;
    if (!videoId) return [];
    return [{
      title: item.snippet?.title ?? 'YouTube video',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      snippet: item.snippet?.description?.slice(0, 400) ?? null,
      platform: 'youtube',
      phase: query.phase,
      publishedAt: item.snippet?.publishedAt ?? null,
      thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? null,
      verificationStatus: 'unverified' as const,
    }];
  });
}

export async function collectSources(queries: ResearchQuery[]) {
  const warnings: string[] = [];
  const hasSerpApi = Boolean(process.env.SERPAPI_API_KEY);
  const hasYouTube = Boolean(process.env.YOUTUBE_API_KEY);
  if (!hasSerpApi) warnings.push('SERPAPI_API_KEY is missing: web, X, Instagram and news discovery were planned but not executed.');
  if (!hasYouTube) warnings.push('YOUTUBE_API_KEY is missing: YouTube discovery was planned but not executed.');

  const selectedQueries = queries.slice(0, 7);
  const batches = await Promise.all(selectedQueries.map(async (query) => {
    try {
      if (query.platform === 'youtube') return await searchYouTube(query);
      return await searchSerpApi(query);
    } catch (error) {
      warnings.push(`${query.platform}/${query.phase} search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }));

  const unique = new Map<string, DiscoveredSource>();
  for (const source of batches.flat()) {
    if (!unique.has(source.url)) unique.set(source.url, source);
  }

  return {
    sources: [...unique.values()],
    integrations: { serpApi: hasSerpApi, youtube: hasYouTube },
    warnings,
  };
}
