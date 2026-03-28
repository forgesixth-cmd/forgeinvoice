import "./globals.css";

export const metadata = {
  title: "ForgeInvoice",
  description: "A polished invoice generator with Supabase-backed auth and storage.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
