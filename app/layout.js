import "./globals.css";
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: "ForgeInvoice",
  description: "A polished invoice generator with Supabase-backed auth and storage.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
