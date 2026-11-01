import { Agent } from '@mastra/core/agent';
import { createOllama } from 'ollama-ai-provider-v2';

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
});

const modelName = process.env.OLLAMA_MODEL || 'qwen3:4b';

export const eventResolverAgent = new Agent({
  id: 'event-resolver',
  name: 'DAYBACK Event Resolver',
  instructions: `You resolve a user's short description into a factual event brief for a historical research system.

Return ONLY valid JSON. Do not use Markdown fences. Never invent a date, location, participant, or fact. If uncertain, use null or an empty array and lower confidence.

Required JSON shape:
{
  "canonicalTitle": string,
  "eventType": string,
  "eventStartDate": string | null,
  "eventEndDate": string | null,
  "location": string | null,
  "timezone": string | null,
  "keyPeopleOrEntities": string[],
  "searchAliases": string[],
  "contextKeywords": string[],
  "confidence": number,
  "needsHumanReview": boolean,
  "resolutionNote": string
}

Dates must be ISO YYYY-MM-DD. For a single-day event, start and end dates may be equal. For an event that spans multiple days, use its meaningful start and end dates. Distinguish the event date from later anniversaries or retrospectives. Treat the user's wording as a search intent, not as proof that every detail is correct. Prefer a few high-confidence aliases and context terms over long keyword lists. Include entities directly involved in the event; do not add loosely associated people merely to broaden search. If multiple events could match, preserve uncertainty and lower confidence rather than guessing.`,
  model: ollama(modelName),
});
