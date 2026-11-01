'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import NewspaperFrontPage from '../components/NewspaperFrontPage';

type Source = {
  title: string;
  url: string;
  snippet: string | null;
  platform: string;
  phase: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  verificationStatus: 'unverified';
};

type ResearchResult = {
  eventInput: string;
  eventBrief: {
    canonicalTitle: string;
    eventType: string;
    eventStartDate: string | null;
    eventEndDate: string | null;
    location: string | null;
    timezone: string | null;
    keyPeopleOrEntities: string[];
    searchAliases: string[];
    contextKeywords: string[];
    confidence: number;
    needsHumanReview: boolean;
    resolutionNote: string;
  };
  resolverMode: 'qwen3' | 'fallback';
  queries: Array<{ platform: string; phase: string; query: string; dateFrom: string | null; dateTo: string | null }>;
  sources: Source[];
  integrations: { serpApi: boolean; youtube: boolean };
  warnings: string[];
};

type SocialFragment = {
  id: string;
  title: string;
  url: string;
  snippet: string | null;
  platform: 'reddit' | 'x';
  phase: 'anticipation' | 'event' | 'aftermath' | 'retrospective';
  category: 'reaction' | 'discussion' | 'eyewitness' | 'public_figure' | 'analysis' | 'other';
  reasonForSelection: string;
  publishedAt: string | null;
};

type SocialArchiveResult = {
  fragments: SocialFragment[];
  integrations: { serpApi: boolean; curator: boolean };
  warnings: string[];
};

type Chapter = 'all' | 'anticipation' | 'event' | 'aftermath' | 'retrospective';

const examples = ['Argentina wins the 2022 FIFA World Cup', 'India wins the 2011 Cricket World Cup', 'The fall of the Berlin Wall'];
const chapters: Array<{ id: Chapter; number: string; title: string; subtitle: string }> = [
  { id: 'all', number: '00', title: 'All memories', subtitle: 'The complete collection' },
  { id: 'anticipation', number: '01', title: 'The anticipation', subtitle: 'Before it happened' },
  { id: 'event', number: '02', title: 'The moment', subtitle: 'As history unfolded' },
  { id: 'aftermath', number: '03', title: 'The aftermath', subtitle: 'When the world reacted' },
  { id: 'retrospective', number: '04', title: 'The legacy', subtitle: 'How we remember it' },
];

function getYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.slice(1) || null;
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] ?? null;
      return parsed.searchParams.get('v');
    }
  } catch { /* Invalid or non-URL source. */ }
  return null;
}

function safeSourceUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch { return null; }
}

function phaseLabel(phase: string) {
  return ({ anticipation: 'The anticipation', event: 'The moment', aftermath: 'The aftermath', retrospective: 'The legacy' } as Record<string, string>)[phase] ?? phase;
}

function platformLabel(platform: string) {
  if (platform === 'youtube') return 'YouTube film';
  if (platform === 'news') return 'News archive';
  if (platform === 'x') return 'Social memory';
  if (platform === 'instagram') return 'Community post';
  return 'Web archive';
}

export default function Home() {
  const [event, setEvent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState('');
  const [activeChapter, setActiveChapter] = useState<Chapter>('all');
  const [selectedArtifact, setSelectedArtifact] = useState<Source | null>(null);
  const [socialArchive, setSocialArchive] = useState<SocialArchiveResult | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState('');
  const socialRequestId = useRef(0);

  useEffect(() => {
    if (!selectedArtifact) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedArtifact(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [selectedArtifact]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const currentSocialRequest = ++socialRequestId.current;
    setLoading(true);
    setError('');
    setResult(null);
    setSelectedArtifact(null);
    setSocialArchive(null);
    setSocialError('');
    setSocialLoading(false);
    setActiveChapter('all');
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Research failed.');
      const researchResult = data as ResearchResult;
      setResult(researchResult);
      // Social research is deliberately independent: it cannot delay or invalidate
      // the existing news/video archive if a platform or the curator is unavailable.
      setSocialLoading(true);
      void fetch('/api/social-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventTitle: researchResult.eventBrief.canonicalTitle || event.trim() }),
      })
        .then(async (socialResponse) => {
          const socialData = await socialResponse.json();
          if (!socialResponse.ok) throw new Error(socialData.error ?? 'Social archive could not be assembled.');
          if (socialRequestId.current === currentSocialRequest) setSocialArchive(socialData as SocialArchiveResult);
        })
        .catch((socialErr) => { if (socialRequestId.current === currentSocialRequest) setSocialError(socialErr instanceof Error ? socialErr.message : 'Social archive could not be assembled.'); })
        .finally(() => { if (socialRequestId.current === currentSocialRequest) setSocialLoading(false); });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const visibleSources = useMemo(() => {
    if (!result) return [];
    return activeChapter === 'all' ? result.sources : result.sources.filter((source) => source.phase === activeChapter);
  }, [result, activeChapter]);

  const altarStories = useMemo(() => {
    const ranked = [...visibleSources].sort((a, b) => {
      const score = (source: Source) => (source.thumbnailUrl ? 3 : 0) + (getYouTubeId(source.url) ? 2 : 0) + (source.platform === 'news' ? 1 : 0);
      return score(b) - score(a);
    });
    return ranked.slice(0, 5);
  }, [visibleSources]);

  return (
    <main className="app-shell">
      <nav className="topbar">
        <a className="wordmark" href="#top" aria-label="DAYBACK home">DAYBACK<span>®</span></a>
        <div className="topbar-center"><span className="topbar-mark" /> AN ARCHIVE OF THE MOMENTS THAT MADE US</div>
        <a className="topbar-link" href="#about">ABOUT THE PROJECT <span>↗</span></a>
      </nav>

      <section className={`hero ${result ? 'hero-compact' : ''}`} id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> COLLECTIVE MEMORY, RECONSTRUCTED</div>
          <h1>Yesterday is<br />not <em>finished.</em></h1>
          <p className="intro">Some moments are too important to exist only in memory. Revisit the photographs, voices, headlines and reactions that surrounded them.</p>
        </div>
        <div className="search-wrap">
          <form className="search-form" onSubmit={handleSubmit}>
            <label htmlFor="event-input">CHOOSE A MOMENT IN TIME</label>
            <div className="input-row">
              <span className="search-symbol">⌕</span>
              <input id="event-input" value={event} onChange={(e) => setEvent(e.target.value)} placeholder="e.g. Argentina wins the 2022 FIFA World Cup" minLength={3} maxLength={300} required />
              <button type="submit" disabled={loading || event.trim().length < 3}>{loading ? 'Gathering…' : 'Relive this'} <span aria-hidden="true">↗</span></button>
            </div>
          </form>
          <div className="examples"><span>STEP INTO</span>{examples.map((item) => <button key={item} type="button" onClick={() => setEvent(item)}>{item}</button>)}</div>
        </div>
      </section>

      {loading && <section className="loading-scene"><div className="loading-orbit"><span /><span /><span /></div><div><div className="eyebrow">PLEASE STAY A MOMENT</div><h2>Gathering the fragments.</h2><p>Finding the voices, images and records surrounding this moment in time.</p></div></section>}
      {error && <section className="error-panel"><strong>We couldn't reconstruct this moment.</strong><span>{error}</span></section>}

      {result && <section className="memory-experience" aria-label="Event memory experience">
        <header className="event-intro">
          <div className="event-intro-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A MOMENT IN THE ARCHIVE</div>
            <h2>{result.eventBrief.canonicalTitle}</h2>
            <p>{result.eventBrief.resolutionNote}</p>
          </div>
          <div className="event-stamp"><span>DAYBACK ARCHIVE</span><strong>{result.eventBrief.eventStartDate ?? 'DATE UNKNOWN'}</strong><small>{result.eventBrief.location ?? 'A moment remembered'}</small></div>
        </header>

        <div className="event-facts">
          <div><span>EVENT TYPE</span><strong>{result.eventBrief.eventType}</strong></div>
          <div><span>DATE</span><strong>{result.eventBrief.eventStartDate ?? 'Unresolved'}</strong></div>
          <div><span>COLLECTED FRAGMENTS</span><strong>{result.sources.length.toString().padStart(2, '0')}</strong></div>
          <div><span>ARCHIVE STATUS</span><strong className="unverified-text">Unverified sources</strong></div>
        </div>

        <div className="altar-heading-row">
          <div><div className="eyebrow">THE MEMORY ALTAR</div><h3>A place for what mattered.</h3><p>Major stories take their place on the altar. Select an object to open the memory it holds.</p></div>
          <div className="collection-count">{result.sources.length} <span>FRAGMENTS PRESERVED</span></div>
        </div>

        <section className="ofrenda ofrenda-image" aria-label="Interactive digital memory altar">
          <div className="ofrenda-image-shade" aria-hidden="true" />
          <div className="ofrenda-image-caption" aria-hidden="true">
            <span>DAYBACK · THE MEMORY ALTAR</span>
            <span>EVERY FRAGMENT HAS A PLACE</span>
          </div>
          <div className="ofrenda-hotspots">
            {altarStories.slice(0, 4).map((source, index) => (
              <button
                type="button"
                key={source.url}
                className={`ofrenda-hotspot ofrenda-hotspot-${index + 1}`}
                onClick={() => setSelectedArtifact(source)}
                aria-label={`Open ${source.title}`}
              >
                <span className="hotspot-kicker">{index === 0 ? 'THE DEFINING MOMENT' : index === 1 ? 'A VOICE REMEMBERED' : index === 2 ? 'FROM THE ARCHIVE' : 'A FRAGMENT PRESERVED'}</span>
                <span className="hotspot-image-frame">
                  {(source.thumbnailUrl || (getYouTubeId(source.url) ? `https://img.youtube.com/vi/${getYouTubeId(source.url)}/hqdefault.jpg` : null))
                    ? <img
                      src={source.thumbnailUrl || `https://img.youtube.com/vi/${getYouTubeId(source.url)}/hqdefault.jpg`}
                      alt=""
                      loading="lazy"
                    />
                    : <span className={`hotspot-fallback hotspot-fallback-${source.platform}`} aria-hidden="true">{source.platform === 'news' ? '✥' : source.platform === 'x' ? '𝕏' : source.platform === 'instagram' ? '◎' : '✦'}</span>}
                </span>
                <strong title={source.title}>{source.title}</strong>
                <span className="hotspot-open">OPEN MEMORY ↗</span>
              </button>
            ))}
            {altarStories.length === 0 && (
              <div className="ofrenda-first-memory">THE FIRST MEMORY WILL REST HERE</div>
            )}
          </div>
          <div className="ofrenda-image-foot" aria-hidden="true">
            <span>✳ &nbsp; MARIGOLDS · CANDLES · MEMORY &nbsp; ✳</span>
            <span>WE KEEP THE MOMENTS THAT MADE US</span>
          </div>
        </section>

        <details className="archive-extras">
          <summary><span><b>Explore the full archive</b><small>Browse every collected fragment, filter by chapter and inspect research queries</small></span><i>＋</i></summary>
          <div className="archive-extra-content">
            <div className="chapter-nav" aria-label="Filter memories by chapter">
              {chapters.map((chapter) => {
                const count = chapter.id === 'all' ? result.sources.length : result.sources.filter((source) => source.phase === chapter.id).length;
                return <button key={chapter.id} className={activeChapter === chapter.id ? 'chapter active' : 'chapter'} onClick={() => setActiveChapter(chapter.id)} type="button">
                  <span className="chapter-number">{chapter.number}</span><span className="chapter-copy"><strong>{chapter.title}</strong><small>{chapter.subtitle}</small></span><span className="chapter-count">{count.toString().padStart(2, '0')}</span>
                </button>;
              })}
            </div>
            {visibleSources.length === 0 ? <div className="empty-altar"><div className="empty-ornament">✳</div><h4>{result.sources.length === 0 ? 'The archive is waiting.' : 'No fragments in this chapter yet.'}</h4><p>{result.sources.length === 0 ? 'The event has been resolved, but no source artifacts were returned. Check the integrations and try the research again.' : 'Try another chapter to explore the material gathered for this event.'}</p></div> : <div className="artifact-grid">
              {visibleSources.map((source, index) => {
                const videoId = getYouTubeId(source.url);
                return <button className={`artifact-card artifact-${source.thumbnailUrl ? 'image' : 'text'} ${videoId ? 'is-video' : ''} ${source.platform === 'x' || source.platform === 'instagram' ? 'is-social' : ''} ${source.platform === 'news' ? 'is-press' : ''}`} key={`${source.url}-${index}`} type="button" onClick={() => setSelectedArtifact(source)}>
                  <div className="artifact-visual">
                    {source.thumbnailUrl ? <img src={source.thumbnailUrl} alt="" loading="lazy" /> : <div className={`artifact-placeholder ${source.platform === 'x' || source.platform === 'instagram' ? 'social-placeholder' : source.platform === 'news' ? 'press-placeholder' : source.platform === 'web' ? 'web-placeholder' : ''}`}>
                      <span>{source.platform === 'news' ? 'FROM THE PRESS' : source.platform === 'x' || source.platform === 'instagram' ? 'A VOICE FROM THE CROWD' : source.platform === 'web' ? 'FROM THE WEB ARCHIVE' : source.platform.toUpperCase()}</span>
                      {source.platform === 'x' || source.platform === 'instagram' ? <p>{source.snippet || source.title}</p> : <strong>{source.platform === 'news' ? 'THE RECORD' : source.platform === 'web' ? source.title : source.title.slice(0, 1)}</strong>}
                      {source.platform !== 'web' && <i>{phaseLabel(source.phase).toUpperCase()}</i>}
                    </div>}
                    {videoId && <span className="play-mark">▶</span>}
                    <span className="artifact-index">FRAGMENT {String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="artifact-copy"><div className="artifact-meta"><span>{platformLabel(source.platform)}</span><i /> <span>{phaseLabel(source.phase)}</span></div><h4>{source.title}</h4>{source.snippet && <p>{source.snippet}</p>}<div className="artifact-open">OPEN FRAGMENT <span>↗</span></div></div>
                </button>;
              })}
            </div>}
          </div>
        </details>

        <section className="voices-section" aria-labelledby="voices-heading">
          <div className="voices-heading">
            <div>
              <div className="eyebrow">THE HUMAN SIDE OF HISTORY</div>
              <h3 id="voices-heading">The Voices Archive</h3>
              <p>A small, independently curated collection of public reactions and discussions. Your main archive remains unchanged.</p>
            </div>
            <div className="voices-stamp"><span>SEPARATE COLLECTION</span><strong>{socialArchive ? String(socialArchive.fragments.length).padStart(2, '0') : '—'}</strong><small>FRAGMENTS</small></div>
          </div>
          {socialLoading ? (
            <div className="voices-state"><span className="voices-pulse" /> <div><strong>Listening to the public conversation.</strong><p>Searching Reddit and X, then selecting a small number of relevant fragments.</p></div></div>
          ) : socialError ? (
            <div className="voices-state voices-state-muted"><strong>The Voices Archive is temporarily unavailable.</strong><p>{socialError} The main Dayback archive is unaffected.</p></div>
          ) : socialArchive && socialArchive.fragments.length > 0 ? (
            <>
              <div className="voices-grid">
                {socialArchive.fragments.map((fragment, index) => (
                  <article className="voice-card" key={fragment.id}>
                    <div className="voice-card-top"><span className={`voice-platform voice-${fragment.platform}`}>{fragment.platform === 'reddit' ? 'REDDIT' : '𝕏 · X'}</span><span className="voice-phase">{phaseLabel(fragment.phase).toUpperCase()}</span></div>
                    <div className="voice-category">{fragment.category.replace('_', ' ').toUpperCase()} · FRAGMENT {String(index + 1).padStart(2, '0')}</div>
                    <h4>{fragment.title}</h4>
                    {fragment.snippet && <p className="voice-excerpt">{fragment.snippet}</p>}
                    <div className="voice-reason"><span>WHY PRESERVED</span>{fragment.reasonForSelection}</div>
                    <a className="voice-open" href={safeSourceUrl(fragment.url) ?? '#'} target="_blank" rel="noopener noreferrer">OPEN ORIGINAL DISCUSSION <span>↗</span></a>
                  </article>
                ))}
              </div>
              <div className="voices-footnote">PUBLIC SEARCH EXCERPTS · ORIGINAL SOURCES LINKED · NOT A REPRESENTATIVE POLL</div>
            </>
          ) : (
            <div className="voices-state voices-state-muted">
              <strong>{socialArchive?.integrations.serpApi ? 'No suitable public fragments were found.' : 'Social discovery is not configured yet.'}</strong>
              <p>{socialArchive?.integrations.serpApi ? 'The curator did not find enough relevant public posts to preserve. Try a more specific event title.' : 'Add SERPAPI_API_KEY to your local environment to enable Reddit and X discovery. The existing archive works without it.'}</p>
              {socialArchive?.warnings.map((warning) => <small key={warning}>{warning}</small>)}
            </div>
          )}
          {socialArchive?.warnings.length ? <div className="voices-warnings">{socialArchive.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div> : null}
        </section>

        <details className="research-details"><summary>Research notes & collection details <span>{result.queries.length} queries · {result.warnings.length} notes</span></summary>
          <div className="research-detail-content">
            <div className="integration-line"><span className={result.integrations.serpApi ? 'on' : ''}>SerpApi {result.integrations.serpApi ? 'connected' : 'not configured'}</span><span className={result.integrations.youtube ? 'on' : ''}>YouTube API {result.integrations.youtube ? 'connected' : 'not configured'}</span><span>{result.resolverMode === 'qwen3' ? 'Qwen3 resolver' : 'Fallback resolver'}</span></div>
            <div className="query-list">{result.queries.map((q, i) => <div className="query-row" key={`${q.platform}-${q.phase}-${i}`}><span>{q.platform}</span><span>{q.phase}</span><p>{q.query}</p></div>)}</div>
            {result.warnings.map((warning) => <p className="warning-note" key={warning}>{warning}</p>)}
          </div>
        </details>
      </section>}

      <footer id="about"><span>DAYBACK — GIVE YESTERDAY A SECOND LIFE.</span><span>AN EXPERIMENT IN COLLECTIVE MEMORY</span></footer>

      {selectedArtifact && <div className="viewer-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedArtifact(null); }}>
        <section className="artifact-viewer" role="dialog" aria-modal="true" aria-label={selectedArtifact.title}>
          <header className="viewer-header"><div className="viewer-brand">DAYBACK <span>/ FRAGMENT VIEWER</span></div><button type="button" className="viewer-close" onClick={() => setSelectedArtifact(null)} aria-label="Close viewer">✕</button></header>
          <div className="viewer-content">
            <div className={`viewer-media ${selectedArtifact.platform === 'news' || selectedArtifact.platform === 'web' ? 'viewer-article-media' : ''}`}>
              {getYouTubeId(selectedArtifact.url) ? <iframe src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(selectedArtifact.url)}?autoplay=1&rel=0`} title={selectedArtifact.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : (selectedArtifact.platform === 'news' || selectedArtifact.platform === 'web') ? <NewspaperFrontPage source={selectedArtifact} /> : selectedArtifact.platform === 'x' || selectedArtifact.platform === 'instagram' ? <article className="social-memory-preview"><div className="preview-kicker">A FRAGMENT OF PUBLIC MEMORY</div><div className="social-preview-top"><span className="social-avatar">{selectedArtifact.platform === 'x' ? '𝕏' : '◎'}</span><div><strong>{selectedArtifact.platform === 'x' ? 'A voice from the timeline' : 'A moment shared'}</strong><small>{selectedArtifact.platform === 'x' ? 'SOCIAL ARCHIVE' : 'COMMUNITY ARCHIVE'}</small></div><span className="social-platform">{selectedArtifact.platform.toUpperCase()}</span></div><h2>{selectedArtifact.title}</h2><p>{selectedArtifact.snippet || 'The original post is preserved at its source. Open the original to see the full conversation and creator context.'}</p><div className="social-preview-rule"/><div className="preview-foot"><span>DAYBACK · COLLECTIVE MEMORY</span><span>ORIGINAL POST ↗</span></div></article> : selectedArtifact.thumbnailUrl ? <img src={selectedArtifact.thumbnailUrl} alt={selectedArtifact.title} /> : <div className="viewer-no-media"><span>DAYBACK ARCHIVE</span><strong>✳</strong><span>FRAGMENT PRESERVED</span></div>}
            </div>
            <div className="viewer-info"><div className="eyebrow">{platformLabel(selectedArtifact.platform)} · {phaseLabel(selectedArtifact.phase)}</div><h2>{selectedArtifact.title}</h2><div className="viewer-excerpt-label">PRESERVED SEARCH EXCERPT</div><p className="viewer-excerpt">{selectedArtifact.snippet || 'No searchable excerpt was supplied for this source. The newspaper rendering preserves the available headline and source metadata.'}</p><div className="source-integrity"><span className="integrity-dot" /> SOURCE NOT YET VERIFIED</div>{safeSourceUrl(selectedArtifact.url) ? <a className="original-source" href={safeSourceUrl(selectedArtifact.url)!} target="_blank" rel="noopener noreferrer">VISIT ORIGINAL PUBLISHER <span>↗</span></a> : <div className="source-link-unavailable">No usable publisher URL was returned for this fragment.</div>}<p className="viewer-disclaimer">The newspaper is a DAYBACK archival rendering made from the available headline, preview image and search excerpt. It is not the publisher’s full article. Follow the source link to read the original report.</p></div>
          </div>
        </section>
      </div>}
    </main>
  );
}
