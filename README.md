# Semantic Search

Paste your documents — search by meaning, not keywords, with highlighted snippets.

> Portfolio Project #7 — [Tai Huynh](https://github.com/huynhchitai)

---

## Demo

Load the sample documents with the **Load samples** button, then try queries like:

- `"how do vectors measure similarity?"`
- `"what is an ANN index?"`
- `"nearest neighbor search algorithms"`
- `"Google text embedding model"`

Results show as catalog index cards: a call-number rank, relevance score, a document
title (linked if a URL was provided), and a snippet with the matched terms highlighted
in burgundy.

---

## Stack

- **Next.js 14** — App Router, `src/` layout, Node.js runtime
- **TypeScript** — `strict: true` throughout
- **Tailwind CSS 3** — CSS variable tokens, library-archive aesthetic
- **Vertex AI** — `text-embedding-004` (768-dim) for both document and query embedding
- **zod 4** — validates every API request boundary
- **Upstash Redis** — sliding-window rate limiter (100 req/day/IP); graceful no-op without it
- **Vitest** — 15-test suite covering XSS safety and cosine similarity
- **pnpm** + **Vercel**

---

## Run locally

```bash
# 1. Install deps
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Fill in GOOGLE_CLOUD_PROJECT and one of the credentials options.
# UPSTASH_* is optional — rate limiting is a no-op without it.

# 3. Start dev server
pnpm dev
# → http://localhost:3000
```

---

## Tests

```bash
pnpm test
# Runs Vitest in single-pass mode.
# Covers: escapeHtml(), extractSnippet() XSS safety, extractSnippet() match behavior,
# cosineSimilarity() properties (symmetry, scale-invariance, orthogonality, etc.)
```

---

## Pipeline at a glance

```
POST /api/index
  { docs: [{ title, content, url? }] }
        │
        ▼
  [1] Zod validate ── max 50 docs, 200k total chars
        │
        ▼
  [2] Rate limit ── Upstash 100/day/IP (rl:search)
        │
        ▼
  [3] Chunk text ── ~500 tok / 50 tok overlap, sentence-boundary preference
        │
        ▼
  [4] Batch embed ── Vertex text-embedding-004, batches ≤10/8k-est-tok
        │            exponential backoff on 429 / UNAVAILABLE
        ▼
  [5] Store ── module-level in-memory StoredChunk[]

POST /api/search
  { query: string 2–300 chars }
        │
        ▼
  [1] Zod validate + rate limit
        │
        ▼
  [2] Embed query ── Vertex text-embedding-004
        │
        ▼
  [3] Cosine similarity over all stored chunk vectors
        │
        ▼
  [4] Dedupe by document, return top-5
        │
        ▼
  [5] Extract snippet ── HTML-escape FIRST, then insert <mark> tags
        │
        ▼
  { results: [{ title, url?, snippet (HTML-safe), score }] }
```

---

## Security stance

### Defended

| Threat | Mitigation |
|--------|------------|
| Oversized input | zod caps: ≤50 docs, ≤200k total chars, ≤100k per doc, query 2–300 chars |
| Abuse / API cost | Upstash sliding-window rate limit, 100 req/day/IP |
| XSS from doc content | `highlight.ts` HTML-escapes all text **before** inserting `<mark>` tags; Vitest spec verifies this invariant |
| Stack traces leaking | Typed error codes returned; detail logged server-side only |
| Credential exposure | GCP service-account keys server-only; `.gitignore` covers all key file patterns |

### Known gaps

- **Ephemeral store**: the in-memory vector store resets on cold start and is not shared across
  Vercel instances. Multiple concurrent instances have independent, unsynchronized stores.
  Production path: Supabase pgvector (see `src/lib/store.ts` comments).
- **No multi-tenant isolation**: documents indexed by one user on an instance are visible to
  all other users on that same instance. For multi-tenant production use, partition by
  session/user ID in pgvector.
- **No authentication**: any IP with the URL can call `/api/index` and overwrite the shared store.
- **Embedding cost unbounded per user**: only rate-limited by request count, not by total chars
  embedded per IP per day.

---

## Known limits

- The in-memory store is wiped on every cold start — it is intentionally a demo constraint.
- Chunking is character-based (≈4 chars/token), not tokenizer-exact — Vietnamese and CJK text
  will get smaller effective windows. The batch-token estimator uses `chars/2` as a pessimistic
  bound to stay safe.
- No incremental indexing: `POST /api/index` replaces the entire store atomically.
- Top-k is fixed at 5 with one-result-per-document deduplication; not configurable via the API.
