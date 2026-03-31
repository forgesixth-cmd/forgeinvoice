import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "ForgeInvoice",
  description: "A polished invoice generator with Supabase-backed auth and storage.",
};

export default function RootLayout({ children }) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
        {plausibleDomain ? (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        ) : null}
        {posthogKey ? (
          <>
            <Script src={`${posthogHost}/static/array.js`} strategy="afterInteractive" />
            <Script
              id="posthog-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.posthog = window.posthog || [];
                  window.posthog.init('${posthogKey}', {
                    api_host: '${posthogHost}',
                    person_profiles: 'identified_only'
                  });
                `,
              }}
            />
          </>
        ) : null}
      </body>
    </html>
  );
}
