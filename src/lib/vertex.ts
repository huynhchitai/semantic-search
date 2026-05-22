import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VertexAI } from '@google-cloud/vertexai';

let cached: VertexAI | null = null;

/**
 * Vertex client. Credentials, in priority order:
 *   1. GOOGLE_APPLICATION_CREDENTIALS       — file path (best for local dev)
 *   2. GOOGLE_APPLICATION_CREDENTIALS_JSON  — single-line JSON (best for Vercel)
 */
export function getVertex(): VertexAI {
  if (cached) return cached;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_REGION ?? 'us-central1';
  if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is not set.');

  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credsJson && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const creds = JSON.parse(credsJson);
      const tmpPath = join(tmpdir(), 'gcp-sa.json');
      writeFileSync(tmpPath, JSON.stringify(creds));
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
    } catch (err) {
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON: ${(err as Error).message}`);
    }
  }

  cached = new VertexAI({ project, location });
  return cached;
}

export const MODEL_ID = 'gemini-2.5-flash';
export const EMBED_MODEL = 'text-embedding-004';
