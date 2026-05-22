import { NextRequest, NextResponse } from 'next/server';
import { SearchRequestSchema } from '@/lib/schema';
import { checkRate, getClientIp } from '@/lib/ratelimit';
import { embedOne } from '@/lib/embeddings';
import { queryStore, storeSize } from '@/lib/store';
import type { SearchResponse, ErrorResponse, ApiError } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const started = Date.now();

  // Rate limit
  const ip = getClientIp(req);
  const rate = await checkRate(ip);
  if (!rate.ok) {
    return apiError('RATE_LIMIT', `Rate limit exceeded (${rate.limit}/day). Try again later.`, 429);
  }

  // Parse + validate input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_INPUT', 'Request body must be valid JSON.', 400);
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return apiError('INVALID_INPUT', msg, 400);
  }

  const { query } = parsed.data;

  // Ensure the store has been populated
  if (storeSize() === 0) {
    return apiError(
      'STORE_EMPTY',
      'No documents have been indexed yet. Use POST /api/index first.',
      409,
    );
  }

  // Embed the query
  let queryVector: number[];
  try {
    queryVector = await embedOne(query);
  } catch (err) {
    console.error('[api/search] embed error:', err);
    return apiError('EMBED_FAIL', 'Failed to embed query. Check server logs.', 502);
  }

  // Run cosine similarity top-k
  const results = queryStore(queryVector, query, 5);

  const response: SearchResponse = {
    ok: true,
    results,
    durationMs: Date.now() - started,
  };
  return NextResponse.json(response);
}

function apiError(error: ApiError, message: string, status: number) {
  const body: ErrorResponse = { ok: false, error, message };
  return NextResponse.json(body, { status });
}
