import { describe, it, expect } from 'vitest';
import { escapeHtml, extractSnippet } from '../highlight';
import { cosineSimilarity } from '../store';

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('is a no-op on plain text', () => {
    expect(escapeHtml('Hello world 123')).toBe('Hello world 123');
  });

  it('escapes multiple HTML special chars in sequence', () => {
    const input = '<script>alert("xss")</script>';
    const out = escapeHtml(input);
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('</script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&lt;/script&gt;');
  });
});

// ---------------------------------------------------------------------------
// extractSnippet — XSS safety
// ---------------------------------------------------------------------------

describe('extractSnippet — XSS safety', () => {
  it('does not let a script tag in doc content execute', () => {
    const docText = 'Hello <script>alert(1)</script> world';
    const result = extractSnippet(docText, 'hello');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('does not let an img onerror tag in doc content execute', () => {
    const docText = 'Check this <img src=x onerror="alert(1)"> image';
    const result = extractSnippet(docText, 'image');
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('does not let an anchor with javascript: href execute', () => {
    const docText = '<a href="javascript:alert(1)">click me</a>';
    const result = extractSnippet(docText, 'click');
    expect(result).not.toMatch(/<a /);
    expect(result).toContain('&lt;a');
  });

  it('escapes HTML entities in doc content', () => {
    const docText = 'This & that < more > stuff';
    const result = extractSnippet(docText, 'stuff');
    expect(result).toContain('&amp;');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('a query with HTML chars does not inject markup', () => {
    const docText = 'This is a safe document with no scripts';
    // Even if somehow a malicious query is passed, no tags should appear in output
    const result = extractSnippet(docText, '<script>');
    expect(result).not.toContain('<script>');
  });
});

// ---------------------------------------------------------------------------
// extractSnippet — matching behavior
// ---------------------------------------------------------------------------

describe('extractSnippet — matching', () => {
  it('wraps a matched query term in <mark> tags', () => {
    const docText = 'The quick brown fox jumps over the lazy dog';
    const result = extractSnippet(docText, 'fox');
    expect(result).toContain('<mark>fox</mark>');
  });

  it('matching is case-insensitive', () => {
    const docText = 'TypeScript is a typed superset of JavaScript';
    const result = extractSnippet(docText, 'typescript');
    expect(result.toLowerCase()).toContain('<mark>typescript</mark>');
  });

  it('marks multiple terms independently', () => {
    const docText = 'React and Vue are popular frontend frameworks';
    const result = extractSnippet(docText, 'react vue');
    expect(result).toContain('<mark>');
  });

  it('returns a snippet even when no term matches', () => {
    const docText = 'A'.repeat(400);
    const result = extractSnippet(docText, 'xyz');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain('<mark>');
  });

  it('adds ellipsis when snippet is a window into a long text', () => {
    const prefix = 'word '.repeat(100);
    const docText = prefix + 'targetword ' + 'word '.repeat(100);
    const result = extractSnippet(docText, 'targetword');
    // Should have ellipsis since match is not at start
    expect(result).toContain('…');
  });

  it('does not add leading ellipsis when match is near the start', () => {
    const docText = 'targetword appears right at the beginning of this document';
    const result = extractSnippet(docText, 'targetword');
    expect(result.startsWith('…')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cosineSimilarity
// ---------------------------------------------------------------------------

describe('cosineSimilarity', () => {
  it('identical vectors have similarity 1', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('orthogonal vectors have similarity 0', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it('opposite vectors have similarity -1', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('returns 0 for a zero-magnitude vector', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('throws on length mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });

  it('is order-independent (symmetric)', () => {
    const a = [0.2, 0.5, 0.8];
    const b = [0.9, 0.1, 0.4];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it('is scale-invariant', () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // = 2 * a
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });
});
