# DAYBACK performance and relevance update

## What changed
- Event resolution prompt now requests one concise JSON response and no longer prints the full model response to the terminal.
- Research queries use a shorter event identity expression and fewer mandatory context terms, improving discovery of natural-language social posts.
- Search execution uses a bounded three-worker pool, a 12-second request timeout, and one bounded retry for HTTP 429 responses.
- Search errors are isolated per query so one failed platform does not cancel the remaining searches.
- Platform URL validation is applied before a result is labelled as Reddit, Instagram, X, News, Web or YouTube.
- News results use SerpApi's dedicated `news_results` rather than mixing in generic organic results.
- YouTube upload-date restrictions are removed because historical-event videos are often uploaded long after the event.
- Event verification now uses at most two sequential SerpApi searches to reduce duplicate work and rate-limit bursts.
- A new `src/lib/relevance-evaluator.ts` evaluates deduplicated candidates in batches of 12, with at most two local Qwen batches running concurrently. If semantic evaluation fails, conservative lexical fallback is used.
- Final results are ranked by relevance and then interleaved across platforms. Diversity does not override relevance.

## Environment
Set these in `.env.local`:
- `OLLAMA_BASE_URL=http://localhost:11434/api`
- `OLLAMA_MODEL=qwen3:4b`
- `SERPAPI_API_KEY=...`
- `YOUTUBE_API_KEY=...`
- `DAYBACK_MAX_SEARCH_QUERIES=24` (allowed range 6-24)

## Install and run
```powershell
npm ci
npm run typecheck
npm run build
npm run dev
```

## Notes and limitations
- Google indexing does not expose every public Instagram or X post. Zero results can reflect indexing limitations, not only application bugs.
- Semantic evaluation uses titles and snippets, not full article/post bodies. Treat low-evidence items conservatively.
- A local Qwen model can remain the largest latency component. Two concurrent relevance batches are a throughput compromise; lower to one worker on machines with limited RAM/VRAM.
- SerpApi 429 responses caused by exhausted account quota cannot be fixed by retries.
- The archive includes the full application source. Dependencies are installed locally with `npm ci`; `node_modules` is intentionally not bundled.
