import { NextRequest, NextResponse } from 'next/server';
import { IndexRequestSchema } from '@/lib/schema';
import { checkRate, getClientIp } from '@/lib/ratelimit';
import { chunkText, embed } from '@/lib/embeddings';
import { storeChunks } from '@/lib/store';
import type { StoredChunk } from '@/lib/types';
import type { IndexResponse, ErrorResponse, ApiError } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;
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

  const parsed = IndexRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return apiError('INVALID_INPUT', msg, 400);
  }

  const { docs } = parsed.data;

  // Build chunks from all documents
  const allChunks: Omit<StoredChunk, 'vector'>[] = [];
  for (let di = 0; di < docs.length; di++) {
    const doc = docs[di];
    const textToChunk = `${doc.title}\n\n${doc.content}`;
    const textChunks = chunkText(textToChunk);
    for (let ci = 0; ci < textChunks.length; ci++) {
      allChunks.push({
        id: `${di}:${ci}`,
        docIndex: di,
        chunkIndex: ci,
        title: doc.title,
        url: doc.url,
        text: textChunks[ci],
      });
    }
  }

  if (allChunks.length === 0) {
    return apiError('INVALID_INPUT', 'No text could be extracted from the provided documents.', 400);
  }

  // Embed all chunks
  let vectors: number[][];
  try {
    vectors = await embed(allChunks.map((c) => c.text));
  } catch (err) {
    console.error('[api/index] embed error:', err);
    return apiError('EMBED_FAIL', 'Failed to generate embeddings. Check server logs.', 502);
  }

  // Build and store full chunks with vectors
  const storedChunks: StoredChunk[] = allChunks.map((c, i) => ({
    ...c,
    vector: vectors[i],
  }));
  storeChunks(storedChunks);

  const response: IndexResponse = {
    ok: true,
    docsIndexed: docs.length,
    chunksIndexed: storedChunks.length,
    durationMs: Date.now() - started,
  };
  return NextResponse.json(response);
}

function apiError(error: ApiError, message: string, status: number) {
  const body: ErrorResponse = { ok: false, error, message };
  return NextResponse.json(body, { status });
}
