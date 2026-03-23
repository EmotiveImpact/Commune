import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Serif+Display:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
