# DAYBACK

**One input. An entire historical experience.** DAYBACK takes an event description and researches how people experienced it using original, source-linked digital artefacts.

## Current milestone

This starter implements the first vertical slice:

1. User enters an event.
2. A Mastra workflow asks Qwen3 (through local Ollama) to resolve the event.
3. The workflow creates phase- and platform-specific search queries.
4. Source adapters query SerpApi and the YouTube Data API when keys are configured.
5. Results are returned with provenance fields and explicitly marked `unverified`.

It does **not** yet claim to have verified posts, generate a finished timeline, or search all social platforms comprehensively. Those are subsequent milestones.

## Stack

- Next.js + TypeScript
- Mastra workflows
- Qwen3 through Ollama (`ollama-ai-provider-v2`)
- SerpApi for indexed web discovery
- YouTube Data API for video discovery
- Supabase/PostgreSQL schema prepared for the persistence milestone

## Requirements

- Node.js 22.18+
- npm
- Ollama installed locally
- Recommended first model: `qwen3:4b` (use a larger Qwen3 model if your hardware supports it)

## Run locally

```powershell
# 1. Install dependencies
npm install

# 2. Pull the model (make sure the Ollama app is running)
ollama pull qwen3:4b

# 3. Create your local environment file
Copy-Item .env.example .env.local

# 4. Optionally add search keys to .env.local
# SERPAPI_API_KEY=...
# YOUTUBE_API_KEY=...

# 5. Start the app
npm run dev
```

Open http://localhost:3000.

## API

`POST /api/research`

```json
{ "event": "Argentina wins the 2022 FIFA World Cup" }
```

The endpoint runs `dayback-research-workflow` and returns the resolved event brief, generated queries, discovered sources, integration status and warnings.

## Search behaviour

- SerpApi is used for web-indexed X, Instagram, news and general web results. This is discovery, not an official X or Instagram archive API.
- YouTube Data API search results include the platform's publication timestamp.
- Google result dates are not treated as verified original publication timestamps.
- All returned material is marked `unverified`. Human/source verification is a separate stage.
- Search is capped at seven generated queries per run to control free-tier usage.
- If API keys are missing, the app still displays the query plan and does not invent results.

## The Voices Archive (optional social research)

After the main event archive has loaded, DAYBACK independently searches indexed public Reddit discussions and X posts through the existing SerpApi key. A separate curator attempts one Qwen3/Ollama selection pass and falls back to local relevance ranking if Ollama is unavailable. Up to eight selected fragments appear in a separate **The Voices Archive** section; they are not added to the existing source list, altar, chapter counts, or newspaper flow.

- Uses the existing `SERPAPI_API_KEY`; no additional API key is required for this first version.
- Reddit discovery is limited to indexed public discussion URLs; comment-level extraction is not included.
- X discovery is based on indexed public post URLs; this is not official X API access.
- Instagram is intentionally deferred.
- If social discovery fails or returns no results, the original event archive continues to work.
- Search snippets and AI classifications are unverified. Always follow the original source link for context.

## Supabase

The initial schema is in `supabase/schema.sql`. Database persistence is intentionally the next milestone after we validate the research flow and result quality.

## Next milestones

1. Verify source URLs, authors, timestamps and embed permissions.
2. Add human curation and source verification UI.
3. Persist events, research runs and content in Supabase.
4. Add Gemma/Qwen classification, deduplication and emotion analysis.
5. Compose adaptive timelines from verified material.
6. Add asynchronous enrichment and event reuse/caching.

## Notes

Never represent an AI-generated reconstruction as an original historical post. Preserve original timestamps separately from retrieval timestamps, link to original sources, and respect platform terms and copyright.


## Retrieval quality and model tuning

The research workflow uses a bounded set of independent, platform-specific queries rather than combining the event title, people, aliases, and every context keyword into one restrictive query. Source searches run concurrently. The planner currently emits up to 14 queries and the source collector has a defensive 16-query cap; SerpApi and YouTube requests ask for up to 10 results per query. Historical YouTube searches intentionally do not apply the event's original publication date, since relevant reaction videos and retrospectives are often uploaded later.

Social discovery runs three distinct query formulations against Reddit and X in parallel (six bounded searches total). Social curation can return up to 20 candidates rather than limiting the archive to eight. The local fallback uses partial event-term coverage so posts that do not repeat the complete canonical title are not automatically discarded.

The Ollama model remains configurable through `OLLAMA_MODEL`; no new model or dependency is required. To benchmark a Gemma model, install it in your Ollama environment and change `OLLAMA_MODEL` in `.env.local`. The default remains `qwen3:4b` so existing installations continue to work. Changing the model does not change the API or workflow contracts.

These retrieval changes improve query diversity and candidate recall, but they do not provide a true semantic embedding reranker. That should be introduced only after measuring latency and relevance on a labelled event benchmark, and ideally as an optional stage so an embedding-service outage cannot break source retrieval. Search provider coverage and rate limits still determine the actual number of results returned.

### Reddit placement in the archive

Reddit discussions are collected by the dedicated Voices Archive workflow. The
main source collector filters Reddit and `redd.it` destinations from general
web/news results so broad organic search results cannot appear as main archive
tiles. The dedicated Reddit search and curation path is unchanged.
