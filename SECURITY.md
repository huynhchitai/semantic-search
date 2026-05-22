# Security — Semantic Search

> Portfolio Project #7 — Tai Huynh

This document describes the threat model, mitigations applied, and — honestly — the
residual gaps for this demo. The gaps are disclosed rather than hidden; naming them
is part of taking security seriously.

---

## Threat model

The attack surface is two unauthenticated HTTP endpoints exposed on Vercel:

| Endpoint | Action | Risk |
|----------|--------|------|
| `POST /api/index` | Embeds caller-supplied text via Vertex AI | Cost abuse, XSS via stored content, denial-of-service |
| `POST /api/search` | Embeds caller-supplied query | Cost abuse, XSS via snippet rendering |

---

## Mitigations

### Input validation (zod)

Every external input is parsed through a strict zod schema before any processing.
Rejection is immediate with a typed error code — no processing occurs on invalid input.

- `/api/index`: max 50 documents, max 200,000 total characters across all docs,
  max 100,000 chars per document body, max 500 chars per title.
- `/api/search`: query must be 2–300 characters.

### Rate limiting (Upstash Redis)

Sliding-window rate limiter: **100 requests per IP per 24 hours**, prefix `rl:search`.
Applied to both endpoints equally. Gracefully degrades to a no-op when Upstash is not
configured (e.g., local dev), so the app never hard-crashes on missing env vars.

IP is extracted from `x-forwarded-for` (first hop) or `x-real-ip`; falls back to
the string `"anon"` — all anonymous traffic shares one bucket, which is conservative.

### XSS from document content

This is the most security-critical path. Documents are untrusted user input and may
contain `<script>`, `<img onerror=…>`, `<a href="javascript:…">`, or other injection
payloads. The snippet extraction pipeline enforces a strict ordering:

1. **HTML-escape the raw text window** (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#x27;`).
2. **Then** insert `<mark>` tags around matched query terms.

This order is non-negotiable: escaping after marking would allow doc content to break
out of the escaped context via the mark-insertion regex. The result is safe to render
via `dangerouslySetInnerHTML` in React because the only raw HTML in the string is
`<mark>…</mark>`, constructed by the application.

A **Vitest test suite** (`src/lib/__tests__/highlight.test.ts`) covers:
- `<script>` tags in doc content become inert `&lt;script&gt;`
- `<img onerror=…>` is escaped
- `<a href="javascript:…">` is escaped
- HTML entities (`&`, `<`, `>`) are normalized
- Query terms with HTML chars do not inject markup
- Match wrapping, case-insensitivity, ellipsis behavior

### XSS from the document `url` field

A document's optional `url` is rendered as an `<a href>`. React does **not** escape URL
schemes, so a `javascript:` / `data:` URI in `href` executes on click — and
`z.string().url()` alone accepts those schemes. Two layers defend this:

1. **`DocSchema.url`** (`src/lib/schema.ts`) adds a `.refine()` http(s) scheme allowlist —
   non-`http(s)` URLs are rejected at the API boundary.
2. **`ResultCard.tsx`** recomputes a `safeUrl` at render time and only emits an `<a href>`
   when the scheme is `http(s)` — defense in depth if a URL ever reaches the component
   through another path.

### No stack traces to the client

All error responses use typed codes (`RATE_LIMIT`, `INVALID_INPUT`, `EMBED_FAIL`,
`STORE_EMPTY`, `INTERNAL`). Internal error details (Vertex error messages, stack traces)
are logged server-side only via `console.error`.

### Credential isolation

- GCP service-account keys are never committed (`.gitignore` covers `*.json`, `*.pem`,
  `gcp-key.json`, `service-account*.json`, `credentials.json`).
- On Vercel, credentials are injected as `GOOGLE_APPLICATION_CREDENTIALS_JSON` (a
  single-line JSON env var), written to a temp file at startup — never persisted to
  the filesystem beyond the function's lifetime.
- `UPSTASH_REDIS_REST_TOKEN` is server-only; never referenced in client components.

---

## Residual gaps

### Ephemeral, non-isolated vector store

The in-memory store has **no user isolation**. All documents indexed on a given Vercel
instance are searchable by all users on that instance. Worse, a new `POST /api/index`
replaces the entire store, wiping any previous user's data.

**For demo purposes this is documented and acceptable.** For production:
- Use Supabase pgvector with rows partitioned by `user_id` or `session_id`.
- Restrict `/api/index` to authenticated users.

### No authentication

Both endpoints are open to any IP. The only abuse protection is rate limiting. There
is no authentication, session, or CSRF protection. For production deployment, add an
auth layer (Clerk, NextAuth, or a signed token) before exposing these endpoints.

### Embedding cost unbounded per character

The rate limit is per-request, not per-character. A user could submit 50 docs of
100,000 characters each (5 million characters, ~1.25 million tokens) within the 100
req/day window, incurring significant Vertex AI cost. Mitigation in production: add a
per-IP daily character budget tracked in Redis alongside the rate limiter.

### Multi-instance incoherence

Vercel can spin up multiple function instances. Requests to `/api/index` and
`/api/search` may hit different instances with different in-memory stores. This is
expected for the demo; it is resolved by moving to pgvector.

---

## Out of scope for this demo

- SSRF (no outbound user-supplied URL fetching occurs — documents are pasted text only)
- SQL injection (no database)
- Prompt injection (no generative model; only embeddings are used)
