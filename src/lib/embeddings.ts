import { getVertex, EMBED_MODEL } from './vertex';

// ~500 tokens / 50-token overlap. Approximate: 1 token ≈ 4 chars for English.
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

/**
 * Split text into overlapping chunks of ~500 tokens each.
 * Tries to break on sentence boundaries; falls back to word boundaries.
 */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    let slice = clean.slice(start, end);

    if (end < clean.length) {
      const lastPeriod = slice.lastIndexOf('. ');
      const lastSpace = slice.lastIndexOf(' ');
      const breakAt =
        lastPeriod > size * 0.6
          ? lastPeriod + 1
          : lastSpace > size * 0.6
          ? lastSpace
          : -1;
      if (breakAt > 0) slice = slice.slice(0, breakAt);
    }

    chunks.push(slice.trim());
    if (end >= clean.length) break;
    start += Math.max(slice.length - overlap, 1);
  }

  return chunks.filter((c) => c.length > 0);
}

// Vertex text-embedding-004 limits:
//   - 250 inputs per request
//   - ~20,000 tokens per request (whole batch)
// Pessimistic: chars/2 covers Vietnamese / CJK / dense text.
const MAX_BATCH_TOKENS = 8_000;
const MAX_BATCH_ITEMS = 10;

function estTokens(s: string): number {
  return Math.ceil(s.length / 2);
}

const RETRY_MAX = 5;
const RETRY_BASE_MS = 1500;
const INTER_BATCH_DELAY_MS = 250;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function callEmbed(batch: string[], attempt = 0): Promise<number[][]> {
  try {
    // Calling getVertex() validates GOOGLE_CLOUD_PROJECT is set and
    // materialises GOOGLE_APPLICATION_CREDENTIALS from the JSON env var if needed.
    getVertex();

    const project = process.env.GOOGLE_CLOUD_PROJECT!;
    const location = process.env.GOOGLE_CLOUD_REGION ?? 'us-central1';

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${EMBED_MODEL}:predict`;

    // Obtain an access token via Application Default Credentials
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;
    if (!accessToken) throw new Error('Failed to obtain GCP access token');

    const body = {
      instances: batch.map((content) => ({ content })),
      parameters: { outputDimensionality: 768 },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vertex embedding HTTP ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      predictions: { embeddings: { values: number[] } }[];
    };

    if (!json.predictions || json.predictions.length !== batch.length) {
      throw new Error(
        `Vertex returned ${json.predictions?.length ?? 0} embeddings for ${batch.length} inputs`,
      );
    }

    return json.predictions.map((p) => {
      if (!p.embeddings?.values) throw new Error('Vertex embedding missing values');
      return p.embeddings.values;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient =
      /429|RESOURCE_EXHAUSTED|Quota exceeded|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(msg);
    if (transient && attempt < RETRY_MAX) {
      const wait = RETRY_BASE_MS * 2 ** attempt + Math.random() * 500;
      await sleep(wait);
      return callEmbed(batch, attempt + 1);
    }
    throw err;
  }
}

/**
 * Embed a list of texts using Vertex text-embedding-004.
 * Batches automatically; retries transient errors with exponential backoff.
 */
export async function embed(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];

  let batch: string[] = [];
  let budget = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const result = await callEmbed(batch);
    out.push(...result);
    batch = [];
    budget = 0;
    onProgress?.(out.length, texts.length);
  };

  for (const t of texts) {
    const tk = estTokens(t);
    if (
      batch.length > 0 &&
      (budget + tk > MAX_BATCH_TOKENS || batch.length >= MAX_BATCH_ITEMS)
    ) {
      await flush();
      await sleep(INTER_BATCH_DELAY_MS);
    }
    batch.push(t);
    budget += tk;
  }
  await flush();

  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  return v;
}
