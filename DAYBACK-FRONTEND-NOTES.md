# DAYBACK frontend milestone 1

## What's changed
- Replaced the light search-results page with a dark archival visual direction.
- Added a memory-experience view after research completes.
- Added chapter filters for anticipation, event, aftermath and retrospective/legacy.
- Rendered discovered sources as a responsive masonry-style artifact wall.
- Added an in-page artifact viewer. YouTube links play in an embedded player; other sources show the metadata and snippet returned by the current API plus a link to the original.
- Moved the query plan and integration diagnostics into a collapsible research-details section.

## Important current limitation
The current research API only returns title, URL, snippet and thumbnail metadata. It does not extract full article text, and it does not fetch full-size image assets. Therefore, the article viewer currently shows the returned snippet rather than claiming to display the complete article. A separate, rights-aware article extraction/reader step can be added later.

## Run locally
1. Copy `.env.local` from your own secure backup (do not commit it).
2. Run `npm ci`.
3. Run `npm run dev`.

The existing `/api/research` endpoint and Mastra workflow were left unchanged.
