
export type EventCandidate = {
  canonicalTitle: string;
  eventType: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  location: string | null;
  timezone: string | null;
  keyPeopleOrEntities: string[];
  searchAliases: string[];
  contextKeywords: string[];
  confidence: number;
  needsHumanReview: boolean;
  resolutionNote: string;
};

export type EventEvidence = {
  id: number;
  title: string;
  url: string;
  snippet: string | null;
  sourceDomain: string;
  searchQuery: string;
};

export type VerificationStatus = 'verified' | 'partially_verified' | 'conflicting' | 'unverified';

export type EventVerification = {
  evidence: EventEvidence[];
  fieldVerification: {
    title: VerificationStatus;
    date: VerificationStatus;
    endDate: VerificationStatus;
    location: VerificationStatus;
    entities: VerificationStatus;
  };
  supportingEvidence: Array<{ field: string; evidenceIds: number[] }>;
  overallStatus: 'verified' | 'partially_verified' | 'needs_clarification';
  warnings: string[];
};

type SearchResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/^www\./, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const compoundSuffixes = new Set(['co.uk', 'org.uk', 'com.au', 'net.au', 'co.in', 'com.br', 'co.jp', 'com.sg', 'com.mx']);
  const suffix = labels.slice(-2).join('.');
  return compoundSuffixes.has(suffix) ? labels.slice(-3).join('.') : labels.slice(-2).join('.');
}

function validHttpUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function extractJson(text: string): Record<string, unknown> {
  const thinkEnd = text.lastIndexOf('</think>');
  const withoutThinking = thinkEnd >= 0 ? text.slice(thinkEnd + 8).trim() : text.trim();
  const cleaned = withoutThinking.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Verification model did not return a JSON object.');
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

/** Retrieve independent web evidence for the candidate event using existing SerpApi credentials. */
export async function retrieveEventEvidence(candidate: EventCandidate): Promise<{
  evidence: EventEvidence[];
  searchCompleted: boolean;
  warnings: string[];
}> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return { evidence: [], searchCompleted: false, warnings: ['SERPAPI_API_KEY is missing; event verification search was not run.'] };
  }

  const title = candidate.canonicalTitle.trim();
  const aliases = candidate.searchAliases.slice(0, 3).map((alias) => `"${alias}"`);
  const queries = [
    `\"${title}\"`,
    [aliases[0], candidate.location].filter(Boolean).map(value => `\"${value}\"`).join(' '),
  ].filter(Boolean).slice(0, 2);

  const warnings: string[] = [];
  const results: Array<{ item: SearchResult; query: string }> = [];

  // Keep verification deliberately small and sequential. It is a validation
  // gate, not a second broad discovery pass, so avoid parallel quota bursts.
  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        engine: 'google',
        api_key: apiKey,
        q: query,
        num: '6',
      });
      const requestUrl = `https://serpapi.com/search.json?${params.toString()}`;
      let response = await fetch(requestUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: 'application/json' },
      });

      // Retry a single rate-limit response, respecting Retry-After when given.
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await response.body?.cancel().catch(() => undefined);
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 6000)
          : 1200;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        response = await fetch(requestUrl, {
          signal: AbortSignal.timeout(10000),
          headers: { Accept: 'application/json' },
        });
      }

      if (!response.ok) throw new Error(`SerpApi returned ${response.status}`);
      const data = await response.json() as {
        organic_results?: SearchResult[];
        news_results?: SearchResult[];
      };
      const items = [...(data.organic_results ?? []), ...(data.news_results ?? [])];
      for (const item of items) results.push({ item, query });
      console.log(`[DAYBACK][VERIFY] http=${response.status} results=${items.length} query="${query}"`);
    } catch (error) {
      warnings.push(`Event verification query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const unique = new Map<string, Omit<EventEvidence, 'id'>>();
  for (const { item, query } of results) {
    const url = validHttpUrl(item.link);
    if (!url || !item.title) continue;
    const normalizedUrl = url.toString();
    if (!unique.has(normalizedUrl)) {
      unique.set(normalizedUrl, {
        title: item.title,
        url: normalizedUrl,
        snippet: item.snippet?.slice(0, 1200) ?? null,
        sourceDomain: registrableDomain(url.hostname),
        searchQuery: query,
      });
    }
  }

  const evidence = [...unique.values()].slice(0, 20).map((item, index) => ({ id: index + 1, ...item }));
  return { evidence, searchCompleted: true, warnings };
}

/**
 * Ask the model to map evidence to candidate facts, then enforce evidence-ID
 * and independent-domain requirements in application code. Model confidence
 * alone never promotes a field to verified.
 */
export async function verifyEventCandidate(candidate: EventCandidate): Promise<EventVerification> {
  const retrieved = await retrieveEventEvidence(candidate);
  const warnings = [...retrieved.warnings];

  if (!retrieved.searchCompleted || retrieved.evidence.length === 0) {
    warnings.push('No external evidence was available. Candidate dates and location will not be used for date-restricted searches.');
    return {
      evidence: retrieved.evidence,
      fieldVerification: { title: 'unverified', date: 'unverified', endDate: 'unverified', location: 'unverified', entities: 'unverified' },
      supportingEvidence: [],
      overallStatus: 'needs_clarification',
      warnings,
    };
  }

  // Deterministic screening avoids a second local Qwen generation.
  // Search snippets are limited evidence and never prove source authenticity.
  const tokens = (value: string) => new Set(
    value.toLowerCase().normalize('NFKD').match(/[a-z0-9]{3,}/g) ?? []
  );
  const supports = (field: 'title' | 'date' | 'endDate' | 'location' | 'entities', item: EventEvidence): boolean => {
    const text = `${item.title} ${item.snippet ?? ''}`;
    if (field === 'date' || field === 'endDate') {
      const fact = field === 'date' ? candidate.eventStartDate : candidate.eventEndDate;
      if (!fact) return false;
      const [year, month, day] = fact.split('-');
      if (!year || !month || !day) return false;
      const monthNames = [
        ['january', 'jan'], ['february', 'feb'], ['march', 'mar'], ['april', 'apr'],
        ['may'], ['june', 'jun'], ['july', 'jul'], ['august', 'aug'],
        ['september', 'sep', 'sept'], ['october', 'oct'], ['november', 'nov'], ['december', 'dec'],
      ];
      const names = monthNames[Number(month) - 1] ?? [];
      const dayNumber = String(Number(day));
      return text.includes(fact) ||
        names.some((name) =>
          new RegExp(`\\b${name}\\.?\\s+${dayNumber}(?:st|nd|rd|th)?[,]?\\s+${year}\\b`, 'i').test(text) ||
          new RegExp(`\\b${dayNumber}(?:st|nd|rd|th)?\\s+${name}\\.?[,]?\\s+${year}\\b`, 'i').test(text)
        ) ||
        new RegExp(`(?:^|\\D)0?${Number(month)}[/-]0?${Number(day)}[/-]${year}(?:\\D|$)`).test(text);
    }
    const fact = field === 'title' ? candidate.canonicalTitle
      : field === 'location' ? candidate.location ?? ''
      : candidate.keyPeopleOrEntities.join(' ');
    const factTokens = [...tokens(fact)];
    const evidenceTokens = tokens(text);
    if (!factTokens.length) return false;
    const matches = factTokens.filter((token) => evidenceTokens.has(token)).length;
    const required = field === 'title' ? Math.min(2, factTokens.length) : 1;
    return matches >= required;
  };

  const fields = ['title', 'date', 'endDate', 'location', 'entities'] as const;
  const fieldVerification = {} as EventVerification['fieldVerification'];
  const supportingEvidence: EventVerification['supportingEvidence'] = [];

  for (const field of fields) {
    const ids = retrieved.evidence.filter((item) => supports(field, item)).map((item) => item.id);
    supportingEvidence.push({ field, evidenceIds: ids });
    const domains = new Set(retrieved.evidence.filter((item) => ids.includes(item.id)).map((item) => item.sourceDomain));
    const hasCandidate = field === 'title' ? Boolean(candidate.canonicalTitle)
      : field === 'date' ? Boolean(candidate.eventStartDate)
      : field === 'endDate' ? Boolean(candidate.eventEndDate)
      : field === 'location' ? Boolean(candidate.location)
      : candidate.keyPeopleOrEntities.length > 0;
    fieldVerification[field] = !hasCandidate || domains.size === 0 ? 'unverified'
      : domains.size >= 2 ? 'verified' : 'partially_verified';
  }

  const requiredVerified = fieldVerification.title === 'verified'
    && (!candidate.eventStartDate || fieldVerification.date === 'verified')
    && (!candidate.eventEndDate || fieldVerification.endDate === 'verified');
  const anySupported = Object.values(fieldVerification).some((status) => status === 'verified' || status === 'partially_verified');
  const overallStatus = requiredVerified ? 'verified' : anySupported ? 'partially_verified' : 'needs_clarification';

  warnings.push('Fast deterministic verification was used to reduce latency. Search snippets are not full-page evidence; manually review important dates, locations and source claims.');
  return { evidence: retrieved.evidence, fieldVerification, supportingEvidence, overallStatus, warnings };
}
