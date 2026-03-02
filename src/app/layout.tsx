import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'PowderIQ — Smart Snow Forecasting',
    template: '%s | PowderIQ',
  },
  description:
    'AI-powered powder score and mountain forecast for skiers and snowboarders.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        className="bg-gray-950 text-gray-100 antialiased"
      >
        {children}
      </body>
    </html>
  );
}
