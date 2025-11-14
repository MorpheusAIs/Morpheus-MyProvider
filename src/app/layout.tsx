import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ApiProvider } from '@/lib/ApiContext';
import { NotificationProvider } from '@/lib/NotificationContext';
import NotificationManager from '@/components/NotificationManager';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "My Morpheus Provider",
  description: "Manage My Providers, Models and Bids for the Morpheus Proxy Router",
  icons: {
    icon: '/morpheus_wings_32x32.png',
    shortcut: '/morpheus_wings_32x32.png',
    apple: '/morpheus_wings_32x32.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <NotificationProvider>
          <ApiProvider>
            <NotificationManager />
            {children}
          </ApiProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}

