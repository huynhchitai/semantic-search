import Link from 'next/link';
import CatalogBar from '@/components/CatalogBar';

export const metadata = {
  title: 'How it works — Semantic Search · Tai Huynh',
};

const ASCII_PIPELINE = `
  ┌───────────────────────────────────────────────────────────────────┐
  │  POST /api/index                                                   │
  │                                                                   │
  │  { docs: [ { title, content, url? } … ] }   ← JSON body          │
  │          │                                                        │
  │          ▼                                                        │
  │  [01] Zod validation                                              │
  │       • max 50 docs  • max 200,000 total chars                    │
  │       • title max 500 chars, content max 100,000 chars            │
  │          │                                                        │
  │          ▼                                                        │
  │  [02] Rate limit — Upstash sliding window 100 req/day/IP          │
  │          │                                                        │
  │          ▼                                                        │
  │  [03] Chunk text — ~500 tok / 50 tok overlap                      │
  │       sentence-boundary preference, word-boundary fallback        │
  │          │                                                        │
  │          ▼                                                        │
  │  [04] Batch embed — Vertex text-embedding-004 (768-dim)           │
  │       up to 10 chunks / 8 000 est-tokens per batch                │
  │       exponential backoff on 429 / UNAVAILABLE                    │
  │          │                                                        │
  │          ▼                                                        │
  │  [05] Store — in-memory module-level array of StoredChunk         │
  │       { id, docIndex, chunkIndex, title, url, text, vector }      │
  └───────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────────┐
  │  POST /api/search                                                  │
  │                                                                   │
  │  { query: string 2–300 chars }              ← JSON body          │
  │          │                                                        │
  │          ▼                                                        │
  │  [01] Zod validation + rate limit (shared window)                 │
  │          │                                                        │
  │          ▼                                                        │
  │  [02] Embed query — Vertex text-embedding-004                     │
  │          │                                                        │
  │          ▼                                                        │
  │  [03] Cosine similarity over all stored chunk vectors             │
  │       score = (A·B) / (|A||B|)                                    │
  │          │                                                        │
  │          ▼                                                        │
  │  [04] Deduplicate — one result per source document (best chunk)   │
  │       Return top-5 by score                                       │
  │          │                                                        │
  │          ▼                                                        │
  │  [05] Highlight — HTML-escape first, then insert <mark> tags      │
  │       ESCAPE → MARK order prevents XSS from doc content           │
  │          │                                                        │
  │          ▼                                                        │
  │  { results: [ { title, url?, snippet (HTML), score } ] }         │
  └───────────────────────────────────────────────────────────────────┘
`.trim();

interface StepProps {
  num: string;
  title: string;
  children: React.ReactNode;
}

function Step({ num, title, children }: StepProps) {
  return (
    <li className="how-step stagger-child" style={{ '--i': parseInt(num, 10) - 1 } as React.CSSProperties}>
      <span className="how-step-num">{num}</span>
      <div>
        <h3 className="how-step-title">{title}</h3>
        <div className="how-step-body">{children}</div>
      </div>
    </li>
  );
}

interface NoteProps {
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}

function Note({ title, accent, children }: NoteProps) {
  return (
    <div className={`how-note ${accent ? 'how-note--accent' : ''}`}>
      <p className="how-note-title">{title}</p>
      <div className="how-note-body">{children}</div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <>
      <CatalogBar here="how" />

      <main className="how-main">
        {/* Hero */}
        <header className="how-hero">
          <p className="hero-eyebrow hero-animate">Engineering notes</p>
          <div className="flex items-end justify-between">
            <h1 className="hero-heading hero-animate" style={{ maxWidth: '18ch' }}>
              How semantic search <em>actually</em> works.
            </h1>
            <Link href="/" className="btn-ghost hero-animate" style={{ marginBottom: '0.5rem' }}>
              ← back to demo
            </Link>
          </div>
          <p className="hero-sub hero-animate" style={{ marginTop: '1.25rem' }}>
            One Vercel deploy, no external vector database. Every search runs as a
            Node.js serverless function. Below: the complete pipeline from raw text
            to ranked, highlighted catalog cards — plus the engineering decisions
            and the gaps that are honestly disclosed.
          </p>
        </header>

        {/* ASCII pipeline */}
        <section style={{ marginTop: '2.5rem' }}>
          <p className="how-pipeline-label">Pipeline diagram</p>
          <pre className="how-pipeline">{ASCII_PIPELINE}</pre>
        </section>

        {/* Two-column layout */}
        <div
          className="how-content-grid"
        >
          {/* Steps */}
          <section>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
                color: 'var(--ink)',
                marginBottom: '2rem',
              }}
            >
              The pipeline, step by step.
            </h2>
            <ol className="how-steps" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <Step num="01" title="Zod input validation">
                Every API request is parsed through a strict zod schema before any
                processing begins. For <code>/api/index</code>: maximum 50 documents,
                200,000 total characters, 100,000 chars per document, 500-char title cap.
                For <code>/api/search</code>: query must be 2–300 characters.
                Malformed or oversized requests are rejected immediately with a typed
                error code — no stack traces reach the client.
              </Step>

              <Step num="02" title="Rate limiting">
                Upstash Redis sliding-window limiter: 100 requests per IP per 24 hours,
                prefix <code>rl:search</code>. Gracefully degrades to a no-op when
                Upstash is not configured (development mode), so the app never hard-crashes
                on missing env vars. The IP is read from <code>x-forwarded-for</code>{' '}
                (first hop only) or <code>x-real-ip</code>.
              </Step>

              <Step num="03" title="Text chunking">
                Long documents are split into ~500-token chunks (≈2000 chars) with a
                50-token overlap (≈200 chars). Chunking prefers sentence boundaries
                (<code>&quot;. &quot;</code>), falling back to word boundaries, keeping semantically
                coherent windows. Overlap ensures that a concept split across a boundary
                still appears in full in at least one chunk.
              </Step>

              <Step num="04" title="Batched embedding via Vertex AI">
                Chunks are embedded in batches of up to 10 items / 8,000 estimated tokens
                using Google&apos;s <code>text-embedding-004</code> model (768-dimensional
                output). Batching is necessary because Vertex has per-request token limits.
                The estimator is deliberately pessimistic (<code>chars/2</code>) to handle
                Vietnamese, CJK, and dense technical text without overrunning the quota.
                Transient errors (429, RESOURCE_EXHAUSTED, UNAVAILABLE) trigger exponential
                backoff up to 5 retries.
              </Step>

              <Step num="05" title="In-memory vector store">
                Vectors are stored in a module-level array in the serverless function.
                Each <code>StoredChunk</code> carries its original text, title, optional
                URL, and the full 768-dimensional float vector. The store is ephemeral:
                it resets on cold start, instance recycling, or redeployment.
                The production upgrade path is Supabase pgvector — the cosine similarity
                becomes a <code>{'<='}&gt;</code> operator call; the top-k is a single
                indexed ANN scan.
              </Step>

              <Step num="06" title="Cosine similarity ranking">
                The query is embedded with the same model. Cosine similarity is computed
                against every stored chunk vector: <code>score = (A·B) / (|A|·|B|)</code>.
                Chunks are ranked descending; one result per source document is returned
                (best-scoring chunk wins), preventing a single long document from dominating
                the top-5 results.
              </Step>

              <Step num="07" title="XSS-safe snippet extraction">
                <strong>This is the most security-critical step.</strong> Document content
                is untrusted — it may contain <code>{'<script>'}</code>,{' '}
                <code>{'<img onerror=…>'}</code>, or other injection payloads.
                The pipeline always HTML-escapes the raw text window{' '}
                <em>before</em> inserting any <code>{'<mark>'}</code> tags. Escape-then-mark
                means the <code>{'<mark>'}</code> tags are constructed by the application,
                never from document content. A Vitest spec verifies this invariant.
              </Step>
            </ol>
          </section>

          {/* Aside notes */}
          <aside className="how-aside" style={{ marginTop: '3.5rem' }}>
            <Note title="Vector store: ephemeral by design">
              The in-memory store intentionally has no external dependency for this
              demo — one <code>pnpm dev</code> is all you need to run it locally.
              The trade-off: state is lost on every cold start and is not shared across
              Vercel instances. For production use, swap <code>src/lib/store.ts</code>{' '}
              for a Supabase pgvector implementation (see comments in that file).
            </Note>

            <Note title="Multi-tenant isolation gap" accent>
              <strong>Known gap:</strong> the in-memory store has no user isolation.
              All documents indexed on the same serverless instance are queryable by
              all users on that instance. For sensitive or multi-tenant use, partition
              by session/user ID in pgvector, or use a per-user ephemeral store
              keyed in Redis.
            </Note>

            <Note title="Embedding model">
              Google Vertex AI <code>text-embedding-004</code> supports up to 2048
              input tokens and produces 768-dimensional output vectors. Suitable for
              semantic retrieval; outperforms older 512-dim models on most English and
              multilingual benchmarks. Authentication uses Application Default
              Credentials (ADC) for local dev and a service-account JSON injected as
              an env var on Vercel — never committed to source control.
            </Note>

            <Note title="XSS safety proof">
              The <code>src/lib/highlight.ts</code> module follows a strict contract:
              (1) HTML-escape <em>all</em> text from doc content; (2) then insert{' '}
              <code>{'<mark>'}</code> tags around matched query terms. The Vitest suite
              (15 tests) covers: script injection, img onerror, javascript: hrefs,
              amp/gt/lt escaping, case-insensitive match wrapping, ellipsis on long text,
              and all edge cases for <code>cosineSimilarity()</code>.
            </Note>
          </aside>
        </div>

        {/* Security stance */}
        <section
          style={{
            marginTop: '3rem',
            padding: '2rem',
            border: '1px solid var(--rule)',
            background: 'var(--cream-card)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--burgundy)',
              marginBottom: '0.75rem',
            }}
          >
            Security stance
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.6rem',
              color: 'var(--ink)',
              marginBottom: '1rem',
            }}
          >
            What is defended. What is not.
          </h2>
          <div className="how-security-grid">
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  color: 'var(--score-excellent)',
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Defended
              </p>
              <ul
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.875rem',
                  color: 'var(--ink-soft)',
                  lineHeight: 1.7,
                  listStyle: 'disc',
                  paddingLeft: '1.25rem',
                }}
              >
                <li>Input size caps (docs, chars, query length) — enforced by zod</li>
                <li>Rate limiting by IP via Upstash sliding window</li>
                <li>XSS from doc content — HTML-escape before mark insertion, Vitest spec covers it</li>
                <li>No stack traces to the client — typed error codes only</li>
                <li>Secrets server-only — GCP credentials never reach the browser or git</li>
                <li>No LLM output in snippet paths — only embeddings, no generative model</li>
              </ul>
            </div>
            <div>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  color: 'var(--burgundy)',
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Known gaps
              </p>
              <ul
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.875rem',
                  color: 'var(--ink-soft)',
                  lineHeight: 1.7,
                  listStyle: 'disc',
                  paddingLeft: '1.25rem',
                }}
              >
                <li>In-memory store is ephemeral and not multi-tenant isolated (documented above)</li>
                <li>No authentication — anyone with the URL can index and search</li>
                <li>No CSRF token on the index endpoint (mitigated by SameSite cookies if auth is added)</li>
                <li>Embedding cost not capped per user — only rate-limited by request count</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="how-cta">
          <div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--burgundy)',
                marginBottom: '0.75rem',
              }}
            >
              Next step
            </p>
            <h3 className="how-cta-heading">
              Want this for your product?
            </h3>
          </div>
          <div>
            <p className="how-cta-body">
              This demo uses an in-memory vector store for zero-dependency simplicity.
              The production version swaps in Supabase pgvector, adds per-user
              partitioning, session-keyed rate limits, and an authenticated API.
              If you have a semantic-search or RAG problem — internal docs, customer
              knowledge bases, code search — email me with the scale and I&apos;ll
              reply within 24 hours.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
              <a
                href="mailto:huynhchitai.070306@gmail.com?subject=Freelance%20enquiry%20—%20Semantic%20Search"
                className="btn-cta"
              >
                Email me →
              </a>
              <Link
                href="/"
                className="btn-cta"
                style={{ background: 'var(--cream-deep)', color: 'var(--ink)', borderColor: 'var(--rule-heavy)' }}
              >
                ← back to demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="catalog-footer">
        <div className="catalog-footer-inner">
          <p className="footer-colophon">
            Tai Huynh · 2026 · Semantic Search · Tai Huynh · Portfolio #07
          </p>
          <p className="footer-colophon">
            <a href="https://github.com/0CCHacker">Tai Huynh</a>
            <span className="footer-sep">·</span>
            <a href="https://github.com/0CCHacker">github</a>
            <span className="footer-sep">·</span>
            <a href="mailto:huynhchitai.070306@gmail.com">email</a>
          </p>
        </div>
      </footer>
    </>
  );
}
