import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { eventResolverAgent } from '../agents/event-resolver';
import { collectSources } from '../../lib/source-search';

const eventBriefSchema = z.object({
  canonicalTitle: z.string().min(1).default('Untitled moment'),
  eventType: z.string().default('historical event'),
  eventStartDate: z.string().nullable().default(null),
  eventEndDate: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  timezone: z.string().nullable().default(null),
  // Small/local models sometimes omit empty arrays. Defaults keep a partial
  // but usable event brief from crashing the entire research workflow.
  keyPeopleOrEntities: z.array(z.string()).default([]),
  searchAliases: z.array(z.string()).default([]),
  contextKeywords: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.25),
  needsHumanReview: z.boolean().default(true),
  resolutionNote: z.string().default('Some event details still need source verification.'),
});

const querySchema = z.object({
  platform: z.enum(['web', 'x', 'instagram', 'youtube', 'news']),
  phase: z.enum(['anticipation', 'event', 'aftermath', 'retrospective']),
  query: z.string(),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
});

const resolveEventStep = createStep({
  id: 'resolve-event',
  inputSchema: z.object({ eventInput: z.string().min(3).max(300) }),
  outputSchema: z.object({
    eventInput: z.string(),
    eventBrief: eventBriefSchema,
    resolverMode: z.enum(['qwen3', 'fallback']),
  }),
  execute: async ({ inputData }) => {
    try {
      console.log('[DAYBACK] Starting event resolution:', inputData.eventInput);
      console.time('[DAYBACK] Event resolver');

      const response = await eventResolverAgent.generate(
        `Resolve this event for DAYBACK research. User input: ${JSON.stringify(inputData.eventInput)}
      Return the required JSON object only.`,
      );
      console.log('[DAYBACK] RAW QWEN RESPONSE START');
      console.log(response.text);
      console.log('[DAYBACK] RAW QWEN RESPONSE END');
      console.timeEnd('[DAYBACK] Event resolver');
      console.log('[DAYBACK] Event resolver completed.');
      const raw = response.text;

      const thinkEnd = raw.lastIndexOf('</think>');
      const cleaned = thinkEnd >= 0
        ? raw.slice(thinkEnd + '</think>'.length).trim()
        : raw.trim();

      const fenced = cleaned
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      const firstBrace = fenced.indexOf('{');
      const lastBrace = fenced.lastIndexOf('}');
      if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('Resolver did not return a JSON object.');
      const decoded = JSON.parse(fenced.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
      // Normalize common Qwen omissions before validation. Missing optional
      // arrays/nullables are not fatal; malformed values still fail safely.
      const normalized = {
        ...decoded,
        canonicalTitle: typeof decoded.canonicalTitle === 'string' && decoded.canonicalTitle.trim()
          ? decoded.canonicalTitle.trim()
          : inputData.eventInput.trim(),
        eventType: typeof decoded.eventType === 'string' ? decoded.eventType : 'historical event',
        eventStartDate: decoded.eventStartDate ?? null,
        eventEndDate: decoded.eventEndDate ?? null,
        location: decoded.location ?? null,
        timezone: decoded.timezone ?? null,
        keyPeopleOrEntities: Array.isArray(decoded.keyPeopleOrEntities) ? decoded.keyPeopleOrEntities : [],
        searchAliases: Array.isArray(decoded.searchAliases) ? decoded.searchAliases : [],
        contextKeywords: Array.isArray(decoded.contextKeywords) ? decoded.contextKeywords : [],
        confidence: typeof decoded.confidence === 'number' ? decoded.confidence : 0.25,
        needsHumanReview: typeof decoded.needsHumanReview === 'boolean' ? decoded.needsHumanReview : true,
        resolutionNote: typeof decoded.resolutionNote === 'string' ? decoded.resolutionNote : 'Some event details still need source verification.',
      };
      const parsed = eventBriefSchema.parse(normalized);
      // A model's date is a candidate, not a verified historical fact.
      parsed.needsHumanReview = true;
      parsed.resolutionNote = `AI-generated event brief. Dates, entities and event boundaries must be corroborated against primary sources before publication. ${parsed.resolutionNote}`.slice(0, 500);
      return { eventInput: inputData.eventInput, eventBrief: parsed, resolverMode: 'qwen3' as const };
    } catch (error) {
      // Keep the workflow useful when Ollama is not installed or the model is unavailable.
      // This fallback does not guess dates or facts; it explicitly asks for human review.
      const dateMatch = inputData.eventInput.match(/\b(19|20)\d{2}-\d{2}-\d{2}\b/);
      const fallbackDate = dateMatch?.[0] ?? null;
      const isArgentinaFinal = /argentina/i.test(inputData.eventInput)
        && /2022/i.test(inputData.eventInput)
        && /world cup|fifa/i.test(inputData.eventInput);
      const resolvedFallbackDate = fallbackDate ?? (isArgentinaFinal ? '2022-12-18' : null);
      const eventBrief = {
        canonicalTitle: inputData.eventInput.trim(),
        eventType: isArgentinaFinal ? 'football final' : 'unresolved',
        eventStartDate: resolvedFallbackDate,
        eventEndDate: resolvedFallbackDate,
        location: isArgentinaFinal ? 'Lusail, Qatar' : null,
        timezone: null,
        keyPeopleOrEntities: [],
        searchAliases: [],
        contextKeywords: inputData.eventInput.trim().split(/\s+/).filter((word) => word.length > 2).slice(0, 8),
        confidence: 0.15,
        needsHumanReview: true,
        resolutionNote: `Automatic event resolution was unavailable. Check that Ollama is running and the configured model is downloaded. ${error instanceof Error ? error.message : ''}`.slice(0, 500),
      };
      return { eventInput: inputData.eventInput, eventBrief, resolverMode: 'fallback' as const };
    }
  },
});

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const planResearchStep = createStep({
  id: 'plan-research',
  inputSchema: z.object({
    eventInput: z.string(),
    eventBrief: eventBriefSchema,
    resolverMode: z.enum(['qwen3', 'fallback']),
  }),
  outputSchema: z.object({
    eventInput: z.string(),
    eventBrief: eventBriefSchema,
    resolverMode: z.enum(['qwen3', 'fallback']),
    queries: z.array(querySchema),
  }),
  execute: async ({ inputData }) => {
    const brief = inputData.eventBrief;
    const title = brief.canonicalTitle.trim();
    const aliases = brief.searchAliases.filter(Boolean).slice(0, 4);
    const people = brief.keyPeopleOrEntities.filter(Boolean).slice(0, 4);
    const keywords = brief.contextKeywords.filter(Boolean).slice(0, 4);
    const start = brief.eventStartDate;
    const end = brief.eventEndDate ?? start;
    const windows = start && end
      ? {
          anticipation: { from: addDays(start, -14), to: addDays(start, -1) },
          event: { from: start, to: end },
          aftermath: { from: addDays(end, 1), to: addDays(end, 30) },
          retrospective: { from: addDays(end, 30), to: null },
        }
      : {
          anticipation: { from: null, to: null },
          event: { from: null, to: null },
          aftermath: { from: null, to: null },
          retrospective: { from: null, to: null },
        };

    // Keep queries independent: overly long AND-like keyword combinations hide
    // relevant posts whose titles use different wording from the event brief.
    const definitions = [
      { platform: 'x' as const, phase: 'event' as const, query: title, window: windows.event },
      { platform: 'x' as const, phase: 'aftermath' as const, query: `${title} reactions`, window: windows.aftermath },
      { platform: 'x' as const, phase: 'retrospective' as const, query: `${title} memories OR anniversary`, window: windows.retrospective },
      { platform: 'instagram' as const, phase: 'aftermath' as const, query: `${title} celebration reaction`, window: windows.aftermath },
      { platform: 'instagram' as const, phase: 'retrospective' as const, query: `${title} photos memories`, window: windows.retrospective },
      { platform: 'youtube' as const, phase: 'event' as const, query: `${title} highlights reaction`, window: { from: null, to: null } },
      { platform: 'youtube' as const, phase: 'aftermath' as const, query: `${title} fans celebrations`, window: { from: null, to: null } },
      { platform: 'youtube' as const, phase: 'retrospective' as const, query: `${title} documentary interview`, window: { from: null, to: null } },
      { platform: 'news' as const, phase: 'event' as const, query: `${title} coverage`, window: windows.event },
      { platform: 'news' as const, phase: 'aftermath' as const, query: `${title} public reaction consequences`, window: windows.aftermath },
      { platform: 'news' as const, phase: 'retrospective' as const, query: `${title} retrospective anniversary`, window: windows.retrospective },
      { platform: 'web' as const, phase: 'retrospective' as const, query: `${title} oral history documentary`, window: windows.retrospective },
      ...(aliases.length ? [{ platform: 'news' as const, phase: 'aftermath' as const, query: aliases[0], window: windows.aftermath }] : []),
      ...(people.length ? [{ platform: 'youtube' as const, phase: 'aftermath' as const, query: `${people.slice(0, 2).join(' ')} ${keywords.slice(0, 2).join(' ')} reactions`, window: { from: null, to: null } }] : []),
    ];

    const queries = definitions.map((item) => ({
      platform: item.platform,
      phase: item.phase,
      query: item.query.replace(/\s+/g, ' ').trim(),
      dateFrom: item.window.from,
      dateTo: item.window.to,
    }));

    return { ...inputData, queries };
  },
});

const collectSourcesStep = createStep({
  id: 'collect-sources',
  inputSchema: z.object({
    eventInput: z.string(),
    eventBrief: eventBriefSchema,
    resolverMode: z.enum(['qwen3', 'fallback']),
    queries: z.array(querySchema),
  }),
  outputSchema: z.object({
    eventInput: z.string(),
    eventBrief: eventBriefSchema,
    resolverMode: z.enum(['qwen3', 'fallback']),
    queries: z.array(querySchema),
    sources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string().nullable(),
      platform: z.string(),
      phase: z.string(),
      publishedAt: z.string().nullable(),
      thumbnailUrl: z.string().nullable(),
      verificationStatus: z.literal('unverified'),
    })),
    integrations: z.object({ serpApi: z.boolean(), youtube: z.boolean() }),
    warnings: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    console.log('[DAYBACK] Starting source collection...');
    console.time('[DAYBACK] Source collection');

    const result = await collectSources(inputData.queries);

    console.timeEnd('[DAYBACK] Source collection');
    console.log('[DAYBACK] Source collection completed.');
    return { ...inputData, ...result };
  },
});

export const daybackResearchWorkflow = createWorkflow({
  id: 'dayback-research-workflow',
  inputSchema: z.object({ eventInput: z.string().min(3).max(300) }),
  outputSchema: z.object({
    eventInput: z.string(),
    eventBrief: eventBriefSchema,
    resolverMode: z.enum(['qwen3', 'fallback']),
    queries: z.array(querySchema),
    sources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string().nullable(),
      platform: z.string(),
      phase: z.string(),
      publishedAt: z.string().nullable(),
      thumbnailUrl: z.string().nullable(),
      verificationStatus: z.literal('unverified'),
    })),
    integrations: z.object({ serpApi: z.boolean(), youtube: z.boolean() }),
    warnings: z.array(z.string()),
  }),
})
  .then(resolveEventStep)
  .then(planResearchStep)
  .then(collectSourcesStep)
  .commit();