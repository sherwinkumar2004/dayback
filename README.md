# DAYBACK 
### Yesterday is not finished.

**What if you could relive a moment in history, not just remember what happened, but experience how the world reacted to it?**

DAYBACK is an AI-powered historical memory archive that transforms an event into an immersive, interactive experience. Give it a moment in time, and it gathers the news, videos and public reactions surrounding it, bringing them together in a digital Día de los Muertos Ofrenda.

Instead of another page of search results, DAYBACK gives history a place to live.

## The Experience

<img width="1405" height="802" alt="image" src="https://github.com/user-attachments/assets/cc80638e-bc21-4cac-b766-6b53ae8934ce" />
<!-- Add Ofrenda screenshot here -->

- **The Memory Altar:** An interactive, pixel-art Ofrenda featuring four carefully selected memories. Each frame opens a different fragment of the event.

<img width="1456" height="887" alt="image" src="https://github.com/user-attachments/assets/8ce3946d-cc2c-474d-a5c5-c9a3e732bfe2" />

- **Four Chapters:** Explore the anticipation, the moment, the aftermath and the legacy of an event.
- **The Archive:** Discover news coverage, web articles and YouTube videos, organised into an interactive collection.
<img width="817" height="738" alt="image" src="https://github.com/user-attachments/assets/f81b79b9-f68f-4be1-a02f-93e1fd57d1c8" />

- **The Newspaper:** News articles are transformed into vintage-style newspaper front pages, viewable without leaving the experience.
<img width="1443" height="531" alt="image" src="https://github.com/user-attachments/assets/abc5bc77-b43d-4432-83f4-c685b6f11e0a" />

- **The Voices Archive:** A separate collection of public Reddit discussions and X posts, curated to capture the human side of history.

## How It Works

```text
Event Description
       ↓
AI Event Resolution (Qwen3)
       ↓
Research Planning (Mastra)
       ↓
Source Discovery (SerpApi + YouTube)
       ↓
Archive & Historical Chapters
       ↓
Interactive Memory Ofrenda

       + Independent Social Research
         (Reddit + X → AI Curation)
```

## Built With

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| AI & Workflows | Qwen3, Ollama, Mastra |
| Search | SerpApi, YouTube Data API |
| Validation | Zod |

## Why Open-Source AI?

DAYBACK uses Qwen3 locally through Ollama, with Mastra orchestrating its research workflow.

Running open-weight models locally gives us control over the models, prompts and curation process. Models can be swapped without redesigning the application, and the system can fall back to local ranking when AI inference is unavailable.

For a project built around preserving collective memory, transparency matters. DAYBACK links every discovered fragment to its original source and labels retrieved material as unverified rather than presenting AI-generated interpretations as historical facts.

## Getting Started

**Prerequisites:** Node.js 22.18+, npm, Ollama and a SerpApi API key.

```bash
git clone https://github.com/sherwinkumar2004/dayback.git
cd dayback
npm install

ollama pull qwen3:4b

# Configure .env.local using .env.example
# Add SERPAPI_API_KEY and optionally YOUTUBE_API_KEY

npm run dev
```

Open `http://localhost:3000`.

## A Note on Accuracy

DAYBACK is a discovery tool, not a verified historical database. Sources are unverified, social results depend on search-engine indexing, and newspaper pages are archival renderings of retrieved headlines and excerpts, not reproductions of original articles.

---

**Because history isn't just what happened. It's what we remember.**
