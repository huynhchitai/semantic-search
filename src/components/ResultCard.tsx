import type { SearchResult } from '@/lib/types';

interface Props {
  result: SearchResult;
  rank: number;
}

function scoreLabel(score: number): string {
  if (score >= 0.85) return 'Excellent';
  if (score >= 0.70) return 'Strong';
  if (score >= 0.55) return 'Moderate';
  return 'Weak';
}

function scoreBand(score: number): string {
  if (score >= 0.85) return 'score--excellent';
  if (score >= 0.70) return 'score--strong';
  if (score >= 0.55) return 'score--moderate';
  return 'score--weak';
}

export default function ResultCard({ result, rank }: Props) {
  const pct = Math.round(result.score * 100);
  const label = scoreLabel(result.score);
  const band = scoreBand(result.score);

  // Defense-in-depth: never put a non-http(s) URL in an href — React does not
  // escape URL schemes, so a `javascript:` URI would execute on click.
  const safeUrl =
    result.url && /^https?:\/\//i.test(result.url) ? result.url : undefined;

  return (
    <li className="result-card stagger-child" style={{ '--i': rank - 1 } as React.CSSProperties}>
      <div className="result-card-inner">
        {/* Catalog drawer tab */}
        <div className="result-tab">
          <span className="result-rank font-mono">{String(rank).padStart(2, '0')}</span>
        </div>

        <div className="result-body">
          <div className="result-header">
            <div className="result-title-group">
              {safeUrl ? (
                <a
                  href={safeUrl}
                  className="result-title"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {result.title}
                </a>
              ) : (
                <h3 className="result-title result-title--no-link">{result.title}</h3>
              )}
              {safeUrl && (
                <span className="result-url font-mono">{safeUrl}</span>
              )}
            </div>

            <div className={`score-badge ${band}`}>
              <span className="score-pct font-mono">{pct}%</span>
              <span className="score-label">{label}</span>
              <div className="score-bar-wrap">
                <div className="score-bar" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Snippet — rendered as HTML; XSS-safe because highlight.ts escapes before marking */}
          <p
            className="result-snippet"
            dangerouslySetInnerHTML={{ __html: result.snippet }}
          />
        </div>
      </div>
    </li>
  );
}
