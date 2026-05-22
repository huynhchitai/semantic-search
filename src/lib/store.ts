/**
 * In-memory vector store.
 *
 * IMPORTANT — EPHEMERAL & PER-INSTANCE:
 *   This store lives in Node.js module scope. It persists only within a single
 *   serverless function instance and is wiped on cold start, instance recycling,
 *   or new deployments. Multiple concurrent instances do NOT share state.
 *
 *   This is intentional for the demo: no external dependencies, zero latency.
 *
 *   Production path: replace StoredChunk.vector storage with Supabase pgvector
 *   (via `pgvector` + `@supabase/supabase-js`). The cosineSimilarity() function
 *   becomes a SQL `<=>` operator call; the top-k query is a single indexed scan.
 *
 *   Multi-tenant isolation: the current in-memory store has NO user isolation —
 *   all indexed documents are visible to all searchers on the same instance.
 *   For multi-tenant production use, partition by session/user ID in pgvector.
 */

import type { StoredChunk, SearchResult } from './types';
import { extractSnippet } from './highlight';

// ---------------------------------------------------------------------------
// In-memory store — module-level singleton
// ---------------------------------------------------------------------------

let chunks: StoredChunk[] = [];

/** Replace the entire store with a new set of chunks. */
export function storeChunks(newChunks: StoredChunk[]): void {
  chunks = newChunks;
}

/** Return a copy of all stored chunks (for introspection / tests). */
export function getChunks(): StoredChunk[] {
  return [...chunks];
}

/** Clear the store. */
export function clearStore(): void {
  chunks = [];
}

/** Return the number of stored chunks. */
export function storeSize(): number {
  return chunks.length;
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

/**
 * Compute cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]; higher is more similar.
 * Returns 0 for zero-magnitude vectors (safe default).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

// ---------------------------------------------------------------------------
// Top-k search
// ---------------------------------------------------------------------------

const DEFAULT_TOP_K = 5;

/**
 * Find the top-k most semantically similar chunks to `queryVector`.
 * Returns SearchResult objects with HTML-safe highlighted snippets.
 */
export function queryStore(
  queryVector: number[],
  query: string,
  topK = DEFAULT_TOP_K,
): SearchResult[] {
  if (chunks.length === 0) return [];

  // Score all chunks
  const scored = chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryVector, chunk.vector),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate: one result per document title (keep best chunk per doc)
  const seen = new Set<string>();
  const top: typeof scored = [];
  for (const item of scored) {
    const key = `${item.chunk.docIndex}`;
    if (!seen.has(key)) {
      seen.add(key);
      top.push(item);
    }
    if (top.length >= topK) break;
  }

  return top.map(({ chunk, score }) => ({
    title: chunk.title,
    url: chunk.url,
    snippet: extractSnippet(chunk.text, query),
    score: Math.round(score * 1000) / 1000,
  }));
}
