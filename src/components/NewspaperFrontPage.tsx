import React from 'react';

type NewspaperSource = {
  title: string;
  url: string;
  snippet: string | null;
  platform: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
};

function publisherName(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '').replace(/^m\./, '').toUpperCase();
  } catch {
    return 'DAYBACK ARCHIVE';
  }
}

function displayDate(value: string | null): string {
  if (!value) return 'ARCHIVE EDITION';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.toUpperCase();
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date).toUpperCase();
}

export default function NewspaperFrontPage({ source }: { source: NewspaperSource }) {
  const imageUrl = source.thumbnailUrl && /^https?:\/\//i.test(source.thumbnailUrl) ? source.thumbnailUrl : null;
  const isNews = source.platform === 'news';

  return (
    <article className="newspaper-sheet" aria-label={`Vintage newspaper rendering of ${source.title}`}>
      <div className="newspaper-paper-grain" aria-hidden="true" />
      <header className="newspaper-topline">
        <span>{displayDate(source.publishedAt)}</span>
        <span>DAYBACK · THE MEMORY ARCHIVE</span>
        <span>{publisherName(source.url)}</span>
      </header>
      <div className="newspaper-masthead">
        <span className="masthead-rule" />
        <div className="masthead-name">THE DAILY <span>✥</span> CHRONICLE</div>
        <div className="masthead-subtitle">A RECORD OF THE MOMENTS THAT SHAPED THE WORLD</div>
        <span className="masthead-rule" />
      </div>
      <div className="newspaper-edition-line">
        <span>{isNews ? 'SPECIAL NEWS EDITION' : 'ARCHIVAL DISPATCH'}</span>
        <span>VOL. 01 &nbsp;·&nbsp; NO. {source.phase === 'aftermath' ? '03' : source.phase === 'event' ? '02' : '01'}</span>
      </div>
      <h1 className="newspaper-headline">{source.title}</h1>
      <div className="newspaper-deck">{source.snippet || 'A fragment preserved from the public record. The original source remains the authority for the full report.'}</div>
      <div className={`newspaper-hero-image ${imageUrl ? '' : 'newspaper-illustration'}`}>
        {imageUrl ? <img src={imageUrl} alt="Original article preview" /> : <div className="newspaper-illustration-inner"><span>✥</span><b>THE<br />PUBLIC<br />RECORD</b><small>AN ARCHIVAL IMPRESSION</small></div>}
        <div className="newspaper-image-caption">{imageUrl ? 'IMAGE PRESERVED FROM THE SOURCE PREVIEW' : 'ILLUSTRATION · NO SOURCE IMAGE AVAILABLE'}</div>
      </div>
      <div className="newspaper-columns">
        <section className="newspaper-column newspaper-column-main">
          <h2>THE STORY</h2>
          <p>{source.snippet || 'This archival fragment records a moment in the public conversation. DAYBACK preserves the discovery and its source so the original reporting can be revisited.'}</p>
          <p className="newspaper-smallprint">This is a designed archival front page based on the available headline and search excerpt. It is not a reproduction of the publisher’s full article.</p>
        </section>
        <aside className="newspaper-column newspaper-column-side">
          <div className="newspaper-side-label">FROM THE ARCHIVE</div>
          <strong>{source.platform.toUpperCase()}</strong>
          <p>{source.phase.replace(/-/g, ' ').toUpperCase()}<br />A MOMENT REMEMBERED</p>
          <div className="newspaper-side-ornament">✥</div>
        </aside>
      </div>
      <footer className="newspaper-footer">
        <span>DAYBACK · COLLECTIVE MEMORY</span>
        <span>THE ORIGINAL REPORT BELONGS TO ITS PUBLISHER</span>
      </footer>
    </article>
  );
}
