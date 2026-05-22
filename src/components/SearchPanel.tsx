'use client';

import { useState, useRef } from 'react';
import type { SearchResponse, SearchResult, ErrorResponse } from '@/lib/types';
import ResultCard from './ResultCard';

interface Props {
  hasIndex: boolean;
}

export default function SearchPanel({ hasIndex }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || query.trim().length < 2) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setDurationMs(null);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = (await res.json()) as SearchResponse | ErrorResponse;
      if (data.ok) {
        setResults(data.results);
        setDurationMs(data.durationMs);
      } else {
        setError(data.message);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-panel">
      <div className="panel-header">
        <h2 className="panel-heading">
          <span className="call-number">02</span>
          Search by Meaning
        </h2>
      </div>

      <form className="search-form" onSubmit={handleSearch}>
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            placeholder={
              hasIndex
                ? 'Ask anything — e.g. "how do vectors measure similarity?"'
                : 'Index documents first, then search…'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!hasIndex || loading}
            minLength={2}
            maxLength={300}
          />
          <button
            className="btn-search"
            type="submit"
            disabled={!hasIndex || loading || query.trim().length < 2}
          >
            {loading ? <span className="spinner spinner--light" /> : 'Search'}
          </button>
        </div>
        {query.length > 0 && (
          <p className="char-hint">
            <span className="font-mono">{query.length}</span>
            <span className="text-ink-quiet"> / 300</span>
          </p>
        )}
      </form>

      {error && (
        <div className="search-error">
          <span className="result-icon">!</span>
          {error}
        </div>
      )}

      {results !== null && (
        <div className="results-section">
          <div className="results-meta">
            <span className="results-count">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
            {durationMs !== null && (
              <span className="results-time font-mono">{durationMs}ms</span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="results-empty">
              No matching documents found. Try a different query.
            </div>
          ) : (
            <ol className="result-list">
              {results.map((r, i) => (
                <ResultCard key={i} result={r} rank={i + 1} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
