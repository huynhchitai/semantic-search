'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CatalogBar({ here }: { here?: 'home' | 'how' }) {
  const pathname = usePathname();
  const isHow = pathname === '/how-it-works' || here === 'how';

  return (
    <header className="catalog-bar">
      <div className="catalog-bar-inner">
        <Link href="/" className="catalog-brand">
          <span className="catalog-call-number">SS.001</span>
          <span className="catalog-title-mark">Semantic Search</span>
        </Link>
        <nav className="catalog-nav">
          <Link
            href="/"
            className={`catalog-nav-link ${!isHow ? 'catalog-nav-link--active' : ''}`}
          >
            Index &amp; Search
          </Link>
          <Link
            href="/how-it-works"
            className={`catalog-nav-link ${isHow ? 'catalog-nav-link--active' : ''}`}
          >
            How it works
          </Link>
          <a
            href="https://github.com/huynhchitai"
            className="catalog-nav-link catalog-nav-link--external"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tai Huynh
          </a>
        </nav>
      </div>
    </header>
  );
}
