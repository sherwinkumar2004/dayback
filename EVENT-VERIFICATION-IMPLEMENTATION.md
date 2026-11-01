# DAYBACK: Issue 1 — Event identification and verification

This update adds a first-pass evidence-backed event verification stage.

## Files changed

- `src/mastra/agents/event-resolver.ts`
  - Keeps Qwen3 as the candidate event extractor.
  - Adds a separate `eventVerificationAgent` that assesses retrieved evidence.
  - Makes the candidate-only nature of resolver output explicit.

- `src/lib/event-verification.ts` (new)
  - Uses the existing `SERPAPI_API_KEY` to search for event identity, date and location evidence.
  - Preserves result URLs, snippets, domains and search queries.
  - Asks the verification agent to map candidate facts to evidence IDs.
  - Enforces a minimum of two distinct source domains before a field can be marked `verified`.
  - Returns `partially_verified`, `conflicting` or `unverified` when evidence is insufficient.

- `src/mastra/workflows/research-workflow.ts`
  - Adds `verifyEventStep` between event resolution and research planning.
  - Clears uncorroborated date boundaries and location before query planning.
  - Clears unverified entities before they are used as query terms.
  - Only enables temporal search windows when both date boundaries are verified.
  - Adds `eventVerification` to the workflow response and merges verification warnings with retrieval warnings.

## Configuration

No new environment variable or package is required. The verification stage reuses:

```env
SERPAPI_API_KEY=your_serpapi_key
OLLAMA_BASE_URL=http://localhost:11434/api
OLLAMA_MODEL=qwen3:4b
```

`YOUTUBE_API_KEY` remains as before for the subsequent YouTube retrieval stage.

## Important behaviour

- If SerpApi is unavailable, the workflow continues with broad, non-date-restricted discovery and reports that event verification could not be completed.
- Candidate dates are not accepted merely because Qwen3 or the user supplied them; the evidence stage must corroborate them.
- A verified field requires at least two distinct source domains whose evidence IDs were selected by the verifier. This is a conservative heuristic, not a guarantee that the sources are authoritative or truly independent.
- The verifier currently assesses search-result titles and snippets. For production-quality verification, fetch and inspect the original source pages before treating critical facts as established.
- `eventVerification` is an additive response field. Existing response fields are retained.

## Run locally

From the `dayback` project directory:

```bash
npm ci
npm run typecheck
npm run dev
```

I could not complete `npm run typecheck` in the file-generation environment because dependency installation timed out and the Node type definitions were unavailable. Please run the commands above locally and share any compiler errors for a follow-up correction.
