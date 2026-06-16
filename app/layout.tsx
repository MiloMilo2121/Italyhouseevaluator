import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Valutatore Immobiliare Delfino',
  description: 'Valutazione gratuita del tuo immobile da un nostro esperto.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
