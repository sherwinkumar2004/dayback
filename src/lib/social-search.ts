import { curateSocialCandidates, type SocialCandidateInput } from './social-curator';

export type SocialFragment = {
  id: string;
  title: string;
  url: string;
  snippet: string | null;
  platform: 'reddit' | 'x';
  phase: 'anticipation' | 'event' | 'aftermath' | 'retrospective';
  category: 'reaction' | 'discussion' | 'eyewitness' | 'public_figure' | 'analysis' | 'other';
  reasonForSelection: string;
  publishedAt: string | null;
};

type SerpItem = { title?: string; link?: string; snippet?: string; date?: string };

function cleanUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'reddit.com' && host !== 'old.reddit.com' && host !== 'x.com' && host !== 'twitter.com') return null;
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|s|ref_src|ref_url)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

async function searchPlatform(platform: 'reddit' | 'x', eventTitle: string): Promise<SocialCandidateInput[]> {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return [];

  const siteQuery = platform === 'reddit'
    ? 'site:reddit.com/r/ '
    : '(site:x.com OR site:twitter.com) ';
  const intent = platform === 'reddit' ? 'discussion reactions perspectives' : 'reaction statement response';
  const params = new URLSearchParams({
    engine: 'google',
    api_key: key,
    q: `${siteQuery}${eventTitle} ${intent}`,
    num: '10',
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`SerpApi ${platform} search returned ${response.status}`);
  const data = await response.json() as { organic_results?: SerpItem[] };

  return (data.organic_results ?? []).flatMap((item, index) => {
    const url = cleanUrl(item.link);
    if (!url) return [];
    const parsed = new URL(url);
    const validReddit = platform === 'reddit' && parsed.hostname.includes('reddit.com') && /\/r\/[^/]+\/comments\//i.test(parsed.pathname);
    const validX = platform === 'x' && (parsed.hostname === 'x.com' || parsed.hostname === 'twitter.com') && /\/status\/\d+/i.test(parsed.pathname);
    if (!validReddit && !validX) return [];
    return [{
      id: `${platform}-${index}-${url}`,
      title: (item.title ?? 'Untitled social post').replace(/\s+/g, ' ').trim().slice(0, 240),
      url,
      snippet: item.snippet?.replace(/\s+/g, ' ').trim().slice(0, 600) ?? null,
      platform,
    }];
  });
}

export async function collectSocialArchive(eventTitle: string) {
  const warnings: string[] = [];
  if (!process.env.SERPAPI_API_KEY) {
    return {
      fragments: [] as SocialFragment[],
      integrations: { serpApi: false, curator: false },
      warnings: ['SERPAPI_API_KEY is not configured. Social discovery is optional and the main Dayback archive is unaffected.'],
    };
  }

  const [redditResult, xResult] = await Promise.allSettled([
    searchPlatform('reddit', eventTitle),
    searchPlatform('x', eventTitle),
  ]);
  const candidates: SocialCandidateInput[] = [];
  if (redditResult.status === 'fulfilled') candidates.push(...redditResult.value);
  else warnings.push(`Reddit discovery failed: ${redditResult.reason instanceof Error ? redditResult.reason.message : 'Unknown error'}`);
  if (xResult.status === 'fulfilled') candidates.push(...xResult.value);
  else warnings.push(`X discovery failed: ${xResult.reason instanceof Error ? xResult.reason.message : 'Unknown error'}`);

  const unique = [...new Map(candidates.map((candidate) => [candidate.url, candidate])).values()];
  if (unique.length === 0) {
    return { fragments: [] as SocialFragment[], integrations: { serpApi: true, curator: false }, warnings };
  }

  const curated = await curateSocialCandidates(eventTitle, unique);
  if (!curated.usedModel) warnings.push('AI curation was unavailable; relevant candidates were ranked using a local fallback.');
  return {
    fragments: curated.fragments,
    integrations: { serpApi: true, curator: curated.usedModel },
    warnings,
  };
}
