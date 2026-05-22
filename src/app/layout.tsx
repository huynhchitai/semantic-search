import type { Metadata } from 'next';
import { DM_Serif_Display, Spline_Sans, Spline_Sans_Mono } from 'next/font/google';
import './globals.css';

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const splineSans = Spline_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

const splineSansMono = Spline_Sans_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Semantic Search — Tai Huynh',
  description:
    'Index your docs — search by meaning, not keywords, with highlighted snippets. Portfolio Project #7 by Tai Huynh.',
  openGraph: {
    title: 'Semantic Search — Tai Huynh',
    description: 'Index your docs — search by meaning, not keywords, with highlighted snippets.',
    siteName: 'Tai Huynh',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${splineSans.variable} ${splineSansMono.variable}`}
    >
      <body className="catalog-body">{children}</body>
    </html>
  );
}
