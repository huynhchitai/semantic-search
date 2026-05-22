'use client';

import { useState } from 'react';
import type { IndexResponse, ErrorResponse } from '@/lib/types';

interface Doc {
  title: string;
  content: string;
  url: string;
}

const SAMPLE_DOCS: Doc[] = [
  {
    title: 'Introduction to Semantic Search',
    url: 'https://example.com/semantic-search',
    content:
      'Semantic search uses natural language processing and machine learning to understand the meaning behind a query rather than matching exact keywords. Unlike traditional keyword search, semantic search can find relevant results even when the exact words do not appear in the document. It leverages dense vector representations called embeddings, where similar concepts are placed close together in high-dimensional space.',
  },
  {
    title: 'Vector Databases Explained',
    url: 'https://example.com/vector-db',
    content:
      'A vector database is a specialized storage system optimized for storing and querying high-dimensional vectors. Popular choices include Pinecone, Weaviate, Qdrant, and Supabase pgvector. These databases support approximate nearest-neighbor (ANN) search algorithms such as HNSW and IVF, enabling sub-millisecond retrieval over millions of vectors. They are the backbone of modern RAG (retrieval-augmented generation) pipelines.',
  },
  {
    title: 'How Embeddings Work',
    url: 'https://example.com/embeddings',
    content:
      'Embeddings are dense numerical representations of text produced by large neural networks. A text embedding model maps sentences or paragraphs to a fixed-length vector (e.g., 768 dimensions for text-embedding-004). The key property is that semantically similar texts produce vectors that are close together, measured by cosine similarity or dot product. Google\'s text-embedding-004 model supports up to 2048 input tokens and produces 768-dimensional output vectors.',
  },
];

interface Props {
  onIndexed: (chunkCount: number) => void;
}

export default function DocIndexPanel({ onIndexed }: Props) {
  const [docs, setDocs] = useState<Doc[]>([{ title: '', content: '', url: '' }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: true; chunks: number; docs: number } | { ok: false; message: string } | null>(null);

  const addDoc = () => {
    if (docs.length >= 50) return;
    setDocs((prev) => [...prev, { title: '', content: '', url: '' }]);
  };

  const removeDoc = (i: number) => {
    setDocs((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateDoc = (i: number, field: keyof Doc, value: string) => {
    setDocs((prev) => prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d)));
  };

  const loadSamples = () => {
    setDocs(SAMPLE_DOCS);
    setResult(null);
  };

  const handleIndex = async () => {
    const validDocs = docs.filter((d) => d.title.trim() && d.content.trim());
    if (validDocs.length === 0) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docs: validDocs.map((d) => ({
            title: d.title.trim(),
            content: d.content.trim(),
            ...(d.url.trim() ? { url: d.url.trim() } : {}),
          })),
        }),
      });
      const data = (await res.json()) as IndexResponse | ErrorResponse;
      if (data.ok) {
        setResult({ ok: true, chunks: data.chunksIndexed, docs: data.docsIndexed });
        onIndexed(data.chunksIndexed);
      } else {
        setResult({ ok: false, message: data.message });
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const totalChars = docs.reduce((s, d) => s + d.title.length + d.content.length, 0);
  const charPct = Math.min((totalChars / 200_000) * 100, 100);

  return (
    <div className="index-panel">
      <div className="panel-header">
        <h2 className="panel-heading">
          <span className="call-number">01</span>
          Index Documents
        </h2>
        <button className="btn-ghost" onClick={loadSamples} type="button">
          Load samples
        </button>
      </div>

      <div className="doc-list">
        {docs.map((doc, i) => (
          <div key={i} className="doc-entry stagger-child" style={{ '--i': i } as React.CSSProperties}>
            <div className="doc-entry-header">
              <span className="doc-label">Doc {String(i + 1).padStart(2, '0')}</span>
              {docs.length > 1 && (
                <button
                  className="btn-remove"
                  onClick={() => removeDoc(i)}
                  type="button"
                  aria-label={`Remove document ${i + 1}`}
                >
                  ×
                </button>
              )}
            </div>
            <input
              className="doc-input"
              placeholder="Title"
              value={doc.title}
              onChange={(e) => updateDoc(i, 'title', e.target.value)}
              maxLength={500}
            />
            <input
              className="doc-input"
              placeholder="URL (optional)"
              value={doc.url}
              onChange={(e) => updateDoc(i, 'url', e.target.value)}
              type="url"
            />
            <textarea
              className="doc-textarea"
              placeholder="Paste document content here…"
              value={doc.content}
              onChange={(e) => updateDoc(i, 'content', e.target.value)}
              maxLength={100_000}
              rows={5}
            />
          </div>
        ))}
      </div>

      <div className="panel-footer">
        <div className="char-meter">
          <div className="char-meter-label">
            <span className="font-mono text-xs">{totalChars.toLocaleString()}</span>
            <span className="text-xs text-ink-quiet"> / 200,000 chars</span>
          </div>
          <div className="char-bar">
            <div
              className="char-bar-fill"
              style={{ width: `${charPct}%` }}
            />
          </div>
        </div>

        <div className="panel-actions">
          {docs.length < 50 && (
            <button className="btn-ghost" onClick={addDoc} type="button">
              + Add document
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleIndex}
            disabled={loading || docs.every((d) => !d.title.trim() || !d.content.trim())}
            type="button"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="spinner" />
                Indexing…
              </span>
            ) : (
              'Index Documents'
            )}
          </button>
        </div>
      </div>

      {result && (
        <div className={`index-result ${result.ok ? 'index-result--ok' : 'index-result--err'}`}>
          {result.ok ? (
            <>
              <span className="result-icon">✓</span>
              <span>
                Indexed <strong>{result.docs}</strong> doc{result.docs !== 1 ? 's' : ''} into{' '}
                <strong>{result.chunks}</strong> chunk{result.chunks !== 1 ? 's' : ''}. Now search below.
              </span>
            </>
          ) : (
            <>
              <span className="result-icon">!</span>
              <span>{result.message}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
