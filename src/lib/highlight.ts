/**
 * XSS-safe snippet extraction and highlighting.
 *
 * SECURITY CONTRACT:
 *   1. ALL text from doc content is HTML-escaped before any markup is inserted.
 *   2. <mark> tags are constructed by the app — never from user/doc content.
 *   3. This means even if a document contains `<script>alert(1)</script>`,
 *      the rendered output will be `&lt;script&gt;alert(1)&lt;/script&gt;`
 *      and no script will execute.
 *
 *   The caller must render the returned string as raw HTML (dangerouslySetInnerHTML
 *   in React) — but it is safe because we escape-then-mark, not mark-then-escape.
 */

const SNIPPET_RADIUS = 160; // chars on each side of the match

/**
 * Escape HTML special characters so they render as text, not markup.
 * This must be applied to ALL untrusted content before inserting any tags.
 */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Extract a window of text around the first occurrence of any query term,
 * HTML-escape it, then wrap matched terms in <mark> tags.
 *
 * The HTML-escape step runs FIRST. The <mark> insertion runs SECOND.
 * This prevents any HTML in the source document from being interpreted.
 *
 * @param text   - Raw document text (untrusted, may contain HTML).
 * @param query  - The search query entered by the user.
 * @returns      - HTML string safe to set via dangerouslySetInnerHTML.
 */
export function extractSnippet(text: string, query: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Split query into individual terms (non-empty, length >= 2)
  const terms = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  // Find the position of the first term match (case-insensitive)
  let matchPos = -1;
  for (const term of terms) {
    const idx = normalized.toLowerCase().indexOf(term.toLowerCase());
    if (idx !== -1) {
      matchPos = idx;
      break;
    }
  }

  // Extract window around match; fall back to the start of the document
  let start: number;
  let end: number;

  if (matchPos !== -1) {
    start = Math.max(0, matchPos - SNIPPET_RADIUS);
    end = Math.min(normalized.length, matchPos + SNIPPET_RADIUS);
  } else {
    start = 0;
    end = Math.min(normalized.length, SNIPPET_RADIUS * 2);
  }

  // Snap to word boundaries
  if (start > 0) {
    const ws = normalized.indexOf(' ', start);
    if (ws !== -1 && ws < start + 40) start = ws + 1;
  }

  let window = normalized.slice(start, end).trim();
  const prefix = start > 0 ? '…' : '';
  const suffix = end < normalized.length ? '…' : '';

  // STEP 1: HTML-escape the raw window content (MUST come before marking)
  const escaped = escapeHtml(window);

  // STEP 2: Wrap matched query terms in <mark> tags (operating on escaped text)
  // After escaping, query terms that contain special HTML chars (&, <, >, etc.)
  // need to match the escaped form. We escape each term before pattern matching.
  let highlighted = escaped;
  for (const term of terms) {
    if (!term) continue;
    // Escape the term for regex special chars (not for HTML — we're matching escaped text)
    const escapedTerm = escapeHtml(term);
    const regexSafe = escapedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${regexSafe})`, 'gi');
    highlighted = highlighted.replace(re, '<mark>$1</mark>');
  }

  return prefix + highlighted + suffix;
}
