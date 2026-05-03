import type { Metadata } from 'next';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'Commune — For people who do life, together',
  description:
    'Track group spending, split costs fairly, and keep shared money clear. No more awkward chasing or guesswork.',
  openGraph: {
    title: 'Commune — For people who do life, together',
    description:
      'Track group spending, split costs fairly, and keep shared money clear.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerifDisplay.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
