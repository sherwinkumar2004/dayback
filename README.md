# DAYBACK

### Yesterday is not finished.

**An interactive digital memorial that brings historical moments back to life through the stories, headlines, videos and public reactions surrounding them.**

What if you could revisit not just an event in history, but how the world experienced it?

DAYBACK turns a historical event into an immersive digital archive. Enter a moment in time, and DAYBACK researches the news coverage, YouTube videos, social posts and public discussions surrounding it, organising the discoveries into an interactive, pixel-art-inspired Día de los Muertos Ofrenda.

Instead of scrolling through a collection of search results, you step into a memory altar. Each object holds a fragment of the past. Each fragment leads back to its original source.

**History is more than what happened. It is how people felt when it happened.**

---

## The Experience

### 1. Give a moment another life

Start with a simple description of an event.

Examples:
- Argentina wins the 2022 FIFA World Cup
- India wins the 2011 Cricket World Cup
- The fall of the Berlin Wall

DAYBACK uses a locally running open-weight AI model to interpret the event, identify its key entities and generate targeted research queries.

### 2. Explore the Memory Ofrenda

The heart of DAYBACK is an interactive digital Ofrenda, inspired by the traditional Día de los Muertos memorial altar.

Designed with a gothic, pixel-art aesthetic, the altar provides a home for the most prominent fragments discovered during research.

- **Interactive keepsakes:** Select the framed objects on the altar to open their associated stories, videos and archival fragments.
- **A living archive:** Source thumbnails and video previews help bring the collected material into the experience.
- **An immersive visual identity:** A dark gothic atmosphere, marigold accents, papel picado and archival details make the experience feel like a place to revisit rather than another search interface.

The altar is the starting point. The complete archive remains available underneath it.

### 3. Explore the full archive

Not every memory belongs to the same moment. DAYBACK organises its discoveries into four chapters:

| Chapter | What it captures |
|---|---|
| The anticipation | Expectations, predictions and conversations before the event |
| The moment | Coverage and media surrounding the event itself |
| The aftermath | Immediate reactions, celebrations and consequences |
| The legacy | Retrospectives, documentaries and how the event is remembered |

Filter the archive by chapter and explore the collected fragments individually.

### 4. Open memories without leaving the experience

Every fragment opens inside DAYBACK's integrated viewer.

Different sources receive different treatments:

- **News and web articles:** Presented as locally rendered, vintage-style newspaper front pages, using the retrieved headline, available preview image and search excerpt.
- **YouTube videos:** Played directly inside the viewer through an embedded YouTube player.
- **Social posts:** Presented as archival social-memory previews, with links to the original posts.
- **Other media:** Displayed using the available source metadata and imagery.

The newspaper treatment is an intentional alternative to embedding publisher websites, many of which prohibit third-party embedding.

Importantly, a newspaper is an archival rendering, not a reproduction of the original article. The original publisher link is always retained.

### 5. The Voices Archive

History is not experienced only through newspapers and documentaries. It is experienced by people.

The Voices Archive is a separate collection dedicated to public reactions and discussions discovered on Reddit and X.

It attempts to preserve different kinds of perspectives:

- Reactions and celebrations.
- Public discussions and debates.
- Eyewitness perspectives.
- Responses from public figures.
- Analysis and retrospective commentary.

A separate AI curator selects relevant fragments and assigns them a category, historical phase and explanation of why they were preserved.

Each entry links to its original discussion.

The Voices Archive runs independently of the main research pipeline. If social discovery fails, the primary event archive remains available.

---

## How It Works

DAYBACK combines local AI inference, structured research workflows and external search integrations.

The system is designed around a simple principle: **AI should help discover and organise historical material, not manufacture historical evidence.**

### Research pipeline

```text
                USER INPUT
                    |
                    v
             EVENT RESOLUTION
              Qwen3 / Ollama
                    |
                    v
             RESEARCH PLANNING
          Platform-specific queries
           Historical phase mapping
                    |
                    v
             SOURCE COLLECTION
             /      |       \
            /       |        \
        SerpApi  YouTube    Search
         News    Data API   Results
         Web       Videos   X / Instagram
            \       |        /
             \      |       /
                    v
             SOURCE ARCHIVE
          URLs, titles, snippets,
          thumbnails and metadata
                    |
                    v
             INTERACTIVE UI
              Memory Ofrenda
              Full Archive
              Fragment Viewer

                    |
                    | Independent workflow
                    v
             VOICES ARCHIVE
                    |
             SerpApi Discovery
                    |
              Reddit + X
                    |
              Qwen3 Curator
                    |
              Local Fallback
                    |
                    v
          CURATED SOCIAL FRAGMENTS
```

### Event resolution

The event resolver uses Qwen3 through Ollama to convert the user's description into a structured event brief containing:

- Canonical event title.
- Event type.
- Candidate start and end dates.
- Location and timezone.
- Key people and entities.
- Alternative event names.
- Contextual search keywords.

The resolver is instructed to preserve uncertainty rather than invent facts.

If the model is unavailable or produces an unusable response, DAYBACK falls back to a conservative event brief rather than allowing the entire workflow to fail.

### Research planning

The research planner creates independent, platform-specific queries across four historical phases.

It avoids forcing every event keyword, person and alias into one restrictive search expression. This helps discover material that discusses an event without necessarily repeating its complete canonical title.

When reliable event dates are available in the candidate brief, they can be used to construct historical search windows. Retrospective searches remain open-ended so later documentaries, anniversary coverage and archival uploads can also be discovered.

### Source collection

DAYBACK uses two primary integrations:

**SerpApi**
- Google organic search for general web discoveries.
- Google News for news articles and publisher coverage.
- Indexed X and Instagram results through site-restricted searches.
- YouTube search as a fallback when the official YouTube API is unavailable or its quota is exhausted.

**YouTube Data API**
- Searches for videos relevant to the event.
- Retrieves video titles, descriptions, publication timestamps and thumbnails.
- Provides the information required for embedded playback.

The retrieval layer normalises URLs, removes common tracking parameters, filters unsuitable destinations and deduplicates repeated results.

Search failures are isolated so that an unavailable provider does not necessarily cancel the entire collection process.

### Social discovery and curation

The Voices Archive has its own collection pipeline.

It runs three distinct query formulations against Reddit and X, producing up to six bounded searches.

Discovered candidates are deduplicated before being passed to the local social curator.

The curator attempts to select up to 20 relevant fragments, prioritising useful perspectives rather than generic mentions.

If Ollama is unavailable, a local lexical relevance-ranking fallback is used.

---

## Open-Source AI at the Core

DAYBACK uses open-weight AI not as an optional chatbot, but as part of the actual research and curation process.

### Qwen3 through Ollama

The default model is `qwen3:4b`, running locally through Ollama.

It powers:

1. Event interpretation and structured event resolution.
2. Social-fragment curation in the Voices Archive.

The model is configurable through environment variables, making it possible to experiment with other Ollama-compatible models without changing the application's API contracts.

### Why local AI matters

Historical research is an interesting application for open-weight models because the system benefits from being able to control how its AI behaves.

- **Model freedom:** Qwen3 can be replaced with another compatible open-weight model, including Gemma.
- **Local inference:** Event resolution and social curation can run on the developer's own machine.
- **Transparency:** Prompts, workflow stages and fallback behaviour are part of the application code.
- **Cost control:** Local inference avoids paying a hosted LLM provider for every event-resolution or curation request.
- **Resilience:** The application has fallback behaviour when local model inference is unavailable.

DAYBACK does not require a proprietary hosted LLM API to perform its core AI tasks.

There is an important distinction, however: DAYBACK is not an entirely offline application. Historical source discovery requires internet connectivity and configured search API credentials. Local inference and external retrieval are deliberately separate responsibilities.

---

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19 | Interactive application |
| Language | TypeScript | Application logic and type safety |
| AI orchestration | Mastra | Structured research workflows |
| Language model | Qwen3 4B | Event resolution and social curation |
| Local inference | Ollama | Running open-weight models locally |
| Model integration | ollama-ai-provider-v2 | Connecting Ollama to Mastra agents |
| Search | SerpApi | Web, news and indexed social discovery |
| Video discovery | YouTube Data API | Historical video discovery |
| Validation | Zod | Structured workflow input/output validation |
| Database preparation | Supabase / PostgreSQL | Initial schema for future persistence |

---

## Getting Started

### Prerequisites

Make sure you have:

- Node.js 22.18 or later.
- npm.
- Ollama installed and running.
- An Ollama-compatible model downloaded.
- A SerpApi API key for source discovery.
- A YouTube Data API key (optional, since SerpApi can provide YouTube fallback discovery).

### 1. Clone the repository

```bash
git clone https://github.com/sherwinkumar2004/dayback.git

cd dayback
```

### 2. Install dependencies

```bash
npm install
```

### 3. Download the AI model

Install the default model through Ollama:

```bash
ollama pull qwen3:4b
```

Make sure the Ollama service is running before starting the application.

### 4. Configure environment variables

Create a `.env.local` file in the project root using `.env.example` as a reference.

```env
# Search integrations
SERPAPI_API_KEY=your_serpapi_api_key
YOUTUBE_API_KEY=your_youtube_api_key

# Local Ollama configuration
OLLAMA_BASE_URL=http://localhost:11434/api
OLLAMA_MODEL=qwen3:4b
```

`SERPAPI_API_KEY` enables the primary web, news, indexed social and Voices Archive discovery integrations.

`YOUTUBE_API_KEY` enables the official YouTube Data API. If it is unavailable, DAYBACK can use SerpApi for YouTube discovery instead.

Keep your API keys private. Never commit `.env.local` to the repository.

### 5. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Other useful commands

```bash
# Run TypeScript checks
npm run typecheck

# Create a production build
npm run build

# Start the production server
npm run start
```

---

## Project Structure

The main application is organised around the following components:

```text
dayback/
│
├── public/
│   └── images/
│       └── dayback-ofrenda.png
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── research/
│   │   │   └── social-research/
│   │   └── page.tsx
│   │
│   ├── components/
│   │   └── NewspaperFrontPage.tsx
│   │
│   ├── lib/
│   │   ├── source-search.ts
│   │   ├── social-search.ts
│   │   ├── social-curator.ts
│   │   ├── relevance-evaluator.ts
│   │   └── event-verification.ts
│   │
│   └── mastra/
│       ├── agents/
│       │   └── event-resolver.ts
│       └── workflows/
│           └── research-workflow.ts
│
├── supabase/
│   └── schema.sql
│
├── .env.example
├── package.json
└── README.md
```

**Note:** This is a conceptual map of the principal modules, not an exhaustive listing of every file.

---

## Limitations and Research Integrity

DAYBACK is an experimental historical research and discovery application. It is important to distinguish discovered material from verified historical evidence.

- **Search indexing:** X and Instagram results depend on what search engines have indexed. They do not represent comprehensive access to either platform.
- **Reddit coverage:** The Voices Archive discovers indexed public discussion URLs. It does not extract complete Reddit comment threads.
- **Social coverage:** The Voices Archive currently covers Reddit and X. Instagram is not part of this separate social-curation workflow.
- **Source verification:** Retrieved sources are marked unverified. A search result is not proof of authenticity, accuracy or historical context.
- **Event resolution:** AI-generated dates, locations and entities are candidate information and should not be treated as independently verified facts.
- **Article content:** DAYBACK does not fetch complete publisher articles. Newspaper pages are designed using available headlines, thumbnails and search excerpts.
- **Publication dates:** Search-engine date labels are not necessarily original publication timestamps. YouTube publication timestamps represent video upload dates, not the dates of the historical events themselves.
- **Social interpretation:** AI-selected categories and explanations are classifications of search-result information, not proof of a post's authenticity or representativeness.
- **Search availability:** Results depend on external search indexes, API quotas, network availability and configured credentials.

DAYBACK aims to preserve the connection between a historical fragment and its original source. It does not generate fictional historical posts, fabricate newspaper articles or claim that reconstructed material is original archival content.

---

## What's Next?

DAYBACK is built around the idea that collective memory deserves more than a list of links.

Possible future directions include:
- Stronger source verification and human-curated historical archives.
- Improved historical timelines with verified publication and event dates.
- Deeper integration of social discussions and original media.
- Persistent event archives and reusable research results.
- More advanced semantic retrieval, deduplication and emotion analysis.

These are potential extensions, not features currently claimed as complete.

---

## A Final Thought

The internet remembers almost everything, but finding the pieces that made a moment meaningful is another matter.

A newspaper headline tells us what happened. A video lets us watch it again. A social post gives us a glimpse of what someone felt. Together, they tell a much richer story.

DAYBACK brings those fragments together, giving yesterday a place to live again.

**Because history isn't just what happened. It's what we remember.**

---

**Built for Hacktoberfest 2026 — DEV Challenge: Ghost in the Machine.**

[GitHub Repository](https://github.com/sherwinkumar2004/dayback) · Built with open-weight AI, Mastra and Ollama.
