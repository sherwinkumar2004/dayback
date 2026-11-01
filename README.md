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
