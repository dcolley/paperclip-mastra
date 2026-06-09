import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tourbillon',
  description: 'Open-source AI agent orchestration — a vortex of agents that never stops',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
