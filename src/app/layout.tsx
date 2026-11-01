import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DAYBACK — Relive the moment',
  description: 'An AI-powered curator for collective memories and historical moments.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
