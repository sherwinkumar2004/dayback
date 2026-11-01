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

/** Reddit discussions belong in the separate Voices Archive, not the main source tiles. */
function isRedditDiscussionUrl(raw: string): boolean {
  try {
    const hostname = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    return hostname === 'reddit.com'
      || hostname.endsWith('.reddit.com')
      || hostname === 'redd.it'
      || hostname.endsWith('.redd.it');
  } catch {
    return false;
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
  const params = new URLSearchParams({ engine: 'google', api_key: key, q: `${site} ${query.query}`.trim(), num: '10' });
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
    // Keep Reddit posts exclusively in the separately curated Voices Archive.
    // This prevents broad Google organic results from surfacing low-relevance
    // Reddit discussions as ordinary web/news tiles. Dedicated social search
    // in social-search.ts is intentionally unchanged.
    if (isRedditDiscussionUrl(url)) return [];
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

async function searchYouTubeViaSerpApi(query: ResearchQuery): Promise<DiscoveredSource[]> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({ engine: 'youtube', api_key: key, search_query: query.query });
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`SerpApi YouTube fallback returned ${response.status}`);
  const data = await response.json() as {
    video_results?: Array<{ title?: string; link?: string; description?: string; published_date?: string; thumbnail?: string | { static?: string } }>;
  };
  return (data.video_results ?? []).flatMap((item) => {
    const url = normalizeResultUrl(item.link);
    if (!url || !/youtube\.com\/watch|youtu\.be\//i.test(url)) return [];
    const thumbnail = typeof item.thumbnail === 'string' ? item.thumbnail : item.thumbnail?.static;
    return [{
      title: decodeCommonEntities(item.title ?? url),
      url,
      snippet: item.description ? decodeCommonEntities(item.description).slice(0, 400) : null,
      platform: 'youtube',
      phase: query.phase,
      // Search-engine dates are not treated as verified publication timestamps.
      publishedAt: null,
      thumbnailUrl: normalizeResultUrl(thumbnail),
      verificationStatus: 'unverified' as const,
    }];
  });
}

async function searchYouTube(query: ResearchQuery): Promise<DiscoveredSource[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (query.platform !== 'youtube') return [];
  if (!key) return searchYouTubeViaSerpApi(query);

  const params = new URLSearchParams({
    key,
    part: 'snippet',
    type: 'video',
    maxResults: '10',
    order: 'relevance',
    q: query.query,
  });
  if (query.dateFrom) params.set('publishedAfter', `${query.dateFrom}T00:00:00Z`);
  if (query.dateTo) params.set('publishedBefore', `${query.dateTo}T23:59:59Z`);

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const details = await response.text();
    const quotaLimited = response.status === 429
      || (response.status === 403 && /quotaExceeded|rateLimitExceeded|userRateLimitExceeded/i.test(details));
    if (quotaLimited && process.env.SERPAPI_API_KEY) {
      console.warn(`[DAYBACK] YouTube Data API limited (${response.status}); using SerpApi YouTube fallback.`);
      return searchYouTubeViaSerpApi(query);
    }
    throw new Error(`YouTube Data API returned ${response.status}${details ? `: ${details.slice(0, 180)}` : ''}`);
  }
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
  if (!hasYouTube && !hasSerpApi) warnings.push('YOUTUBE_API_KEY and SERPAPI_API_KEY are missing: YouTube discovery was planned but not executed.');

  // The planner emits a bounded set of diverse, platform-specific queries.
  // Keep a defensive cap so malformed callers cannot trigger unbounded API use.
  // Keep a single event from fanning out into many costly YouTube search.list
  // calls. SerpApi remains the fallback when the YouTube quota/rate limit is hit.
  const selectedQueries = queries.slice(0, 16);
  const youtubeQueries = selectedQueries.filter((query) => query.platform === 'youtube').slice(0, 2);
  const otherQueries = selectedQueries.filter((query) => query.platform !== 'youtube');
  // Keep non-YouTube providers parallel, but serialize YouTube search.list
  // requests to avoid burst rate limits. Each YouTube query can fall back to
  // SerpApi if the official API quota or rate limit is exhausted.
  const otherBatches = await Promise.all(otherQueries.map(async (query) => {
    try {
      return await searchSerpApi(query);
    } catch (error) {
      warnings.push(`${query.platform}/${query.phase} search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }));
  const youtubeBatches: DiscoveredSource[][] = [];
  for (const query of youtubeQueries) {
    try {
      youtubeBatches.push(await searchYouTube(query));
    } catch (error) {
      warnings.push(`${query.platform}/${query.phase} search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      youtubeBatches.push([]);
    }
  }

  const unique = new Map<string, DiscoveredSource>();
  for (const source of [...otherBatches, ...youtubeBatches].flat()) {
    if (!unique.has(source.url)) unique.set(source.url, source);
  }

  return {
    sources: [...unique.values()],
    integrations: { serpApi: hasSerpApi, youtube: hasYouTube },
    warnings,
  };
}
