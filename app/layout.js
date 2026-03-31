import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "ForgeInvoice",
  description: "A polished invoice generator with Supabase-backed auth and storage.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
