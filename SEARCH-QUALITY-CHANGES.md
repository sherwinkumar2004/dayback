# DAYBACK search-quality changes

## What changed

### Retrieval breadth
- Research planning now creates a platform-by-phase query matrix (5 platforms x 4 phases).
- The runtime query budget is configurable with `DAYBACK_MAX_SEARCH_QUERIES` (default 20, bounded 5-30).
- Requests execute in batches of four to avoid launching every provider request simultaneously.

### Historical date handling
- Verified event dates may constrain anticipation, event and aftermath searches.
- Retrospective searches are open-ended. YouTube retrospective searches explicitly omit `publishedAfter` and `publishedBefore`, because later documentaries, anniversary coverage and archival uploads are often valuable.
- Search-provider publication dates are kept separate from event dates. Google result date labels are not represented as verified timestamps.

### Result quality
- URL normalization removes common tracking parameters and rejects search-engine redirect/cache destinations.
- Duplicate URLs are merged while preserving richer snippets, thumbnails and timestamps.
- Results receive an explainable lexical relevance score using event title/aliases, entities, location and context keywords. Low-scoring items are retained, with warnings, to avoid silently harming recall.
- The UI orders featured items by relevance and shows the score for review.

### Event verification
- Event-evidence discovery now uses aliases and named entities and includes news results.
- Domain independence is approximated at registrable-domain level (including common compound public suffixes).
- Model-supplied evidence IDs are filtered through a basic text-support check before they count toward field verification.
- This remains a conservative heuristic: snippets are not full-page evidence, and a year appearing in a snippet is not definitive proof of an event date.

## Configuration

```env
DAYBACK_MAX_SEARCH_QUERIES=20
```

Set 5-30. Larger values improve discovery breadth but consume more provider quota and increase response time.

## Known limitations

- Google-indexed X and Instagram results are incomplete and are not equivalent to platform archive access.
- The lexical relevance score is language-sensitive and can under-score transliterated or non-English material. Do not use it as a hard exclusion rule.
- Search result titles/snippets do not prove that a source is authentic, independent, or contemporaneous.
- Full article extraction, transcript retrieval, platform-specific historical archives, and human curation remain future work.
- YouTube's `publishedAt` is the upload/publication time, not the event's occurrence time.

## Validation

After installing dependencies, run:

```bash
npm run typecheck
npm run build
```

Then test at least:
1. A dated single-day event with original coverage.
2. A multi-day event.
3. An old event with recent retrospective YouTube videos.
4. An event with multiple common aliases.
5. An ambiguous event name that should remain flagged for human review.


## Retrieval latency follow-up

- Default live retrieval budget is 12 balanced queries instead of 20.
- Selected provider searches run concurrently instead of serial batches.
- Search requests have a 9-second timeout; event-evidence requests have an 8-second timeout.
- Event verification uses a deterministic evidence screen rather than invoking Qwen a second time.
- `/no_think` is prepended to the event-resolution request to reduce unnecessary reasoning-token latency with Qwen3.
- Increase `DAYBACK_MAX_SEARCH_QUERIES` only after measuring latency; supported maximum is 20.


## Platform diversity update

- Final archive selection now targets 7 news, 5 YouTube, 3 X, 2 Instagram and 3 general-web results (20 total).
- If several platforms return relevant candidates, no single platform can exceed 8 of the 20 selected results. If only one platform returns material, its strongest results are retained rather than hidden.
- Remaining slots are filled by relevance while respecting the 40% per-platform cap.
- Social query terms now explicitly include eyewitness accounts, reactions, threads, photos, reels, celebrations, replies and event hashtags without increasing the number of API calls.
- Removed thumbnail and YouTube-specific ranking bonuses from the altar. Featured altar items preserve the API's diversity-aware ordering and limit each platform to two featured items.
- Added an archive composition indicator showing the actual News, YouTube, Social and Web mix.


## Retrieval breadth and platform coverage correction

- Removed the hard 20-source result cap. Diversity now changes ordering only; all unique retrieved sources are retained.
- Increased the default query budget from 12 to 18 (configurable up to 24).
- Query selection is platform-first, ensuring the request budget is distributed across News, Reddit, Instagram, X, YouTube and general web rather than exhausting early platforms.
- Added Reddit as a first-class retrieval platform using Google-indexed `site:reddit.com` results through the existing SerpApi integration. No Reddit API credentials are required for this indexed discovery path.
- Added Reddit to the workflow schema, result labels, archive composition and artifact viewer.
- News queries now explicitly target reporting from newspapers, broadcasters and television channels.
- Instagram and X remain dependent on public search-engine indexing; this is not a complete archive of either platform.
- Results are relevance-ranked within platform and then interleaved for diversity. No result is dropped just to meet a platform quota.
