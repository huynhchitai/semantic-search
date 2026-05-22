/** A single document provided by the user to index. */
export interface InputDoc {
  title: string;
  content: string;
  url?: string;
}

/** A stored chunk with its embedding vector. */
export interface StoredChunk {
  /** Unique chunk id: `${docIndex}:${chunkIndex}` */
  id: string;
  docIndex: number;
  chunkIndex: number;
  title: string;
  url?: string;
  text: string;
  vector: number[];
}

/** A single search result returned to the client. */
export interface SearchResult {
  title: string;
  url?: string;
  /** HTML-safe snippet with query match wrapped in <mark> tags. */
  snippet: string;
  /** Cosine similarity score in [0, 1]. */
  score: number;
}

/** Response from POST /api/index */
export interface IndexResponse {
  ok: true;
  docsIndexed: number;
  chunksIndexed: number;
  durationMs: number;
}

/** Response from POST /api/search */
export interface SearchResponse {
  ok: true;
  results: SearchResult[];
  durationMs: number;
}

/** Generic error response */
export interface ErrorResponse {
  ok: false;
  error: string;
  message: string;
}

export type ApiError =
  | 'RATE_LIMIT'
  | 'INVALID_INPUT'
  | 'EMBED_FAIL'
  | 'STORE_EMPTY'
  | 'INTERNAL';
