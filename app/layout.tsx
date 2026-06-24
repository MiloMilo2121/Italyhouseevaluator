import type { Metadata } from 'next';
import { Fraunces, Geist } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});
const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Valutazione immobiliare — stima gratuita in 24h',
  description: 'Scopri quanto vale il tuo immobile: stima gratuita di un esperto, su dati ufficiali, entro 24 ore.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${fraunces.variable} ${geist.variable}`}>
      <body>{children}</body>
    </html>
  );
}
