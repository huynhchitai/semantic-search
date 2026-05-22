'use client';

import { useState } from 'react';
import Link from 'next/link';
import CatalogBar from '@/components/CatalogBar';
import DocIndexPanel from '@/components/DocIndexPanel';
import SearchPanel from '@/components/SearchPanel';

export default function Home() {
  const [hasIndex, setHasIndex] = useState(false);

  return (
    <>
      <CatalogBar here="home" />

      <div className="page-hero">
        <p className="hero-eyebrow hero-animate">Portfolio Project 07 · Tai Huynh</p>
        <h1 className="hero-heading hero-animate">
          Search by <em>meaning,</em>
          <br />
          not by keywords.
        </h1>
        <p className="hero-sub hero-animate">
          Paste your documents, click Index, then ask anything in natural language.
          Results arrive as catalog cards — relevance score, highlighted snippet,
          and a direct link — powered by Vertex&nbsp;AI text-embedding-004.
        </p>
      </div>

      <main className="catalog-main">
        <div className="catalog-grid">
          <DocIndexPanel onIndexed={(n) => setHasIndex(n > 0)} />
          <SearchPanel hasIndex={hasIndex} />
        </div>

        {/* Decorative catalog rule strip */}
        <div
          style={{
            marginTop: '3rem',
            borderTop: '3px solid var(--rule-heavy)',
            borderBottom: '1px solid var(--rule-soft)',
            height: '6px',
          }}
        />

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <Link href="/how-it-works" className="btn-ghost" style={{ fontSize: '0.8rem' }}>
            How does it work? →
          </Link>
        </div>
      </main>

      <footer className="catalog-footer">
        <div className="catalog-footer-inner">
          <p className="footer-colophon">
            Tai Huynh · 2026 · Semantic Search · Portfolio #07
          </p>
          <p className="footer-colophon">
            <a href="https://github.com/0CCHacker">Tai Huynh</a>
            <span className="footer-sep">·</span>
            <a href="https://github.com/0CCHacker">github</a>
            <span className="footer-sep">·</span>
            <a href="mailto:huynhchitai.070306@gmail.com">email</a>
          </p>
        </div>
      </footer>
    </>
  );
}
